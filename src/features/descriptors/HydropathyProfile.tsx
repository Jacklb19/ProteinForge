import { useEffect, useMemo, useRef, useState } from 'react';
import { validateSequence } from '../editor/sequence';
import { getChartStyle } from './chartStyle';
import type { ProfileResponse, ProfileRequest } from './profileMessages';
import type { ProfilePoint, HydropathyWindow } from './profile';
import type { ResiduePropensity } from './chouFasman';

const ROWS_PER_PAGE = 50;
const VALUE_FORMAT = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

interface ReceivedProfile {
  sequence: string;
  windowSize: HydropathyWindow;
  points: ProfilePoint[];
  propensities: ResiduePropensity[];
}

/** Draws the profile off the main thread and presents its values in a table. */
export function HydropathyProfile({ text }: { text: string }): React.JSX.Element {
  const [windowSize, setWindowSize] = useState<HydropathyWindow>(9);
  const [profile, setProfile] = useState<ReceivedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const chartUnavailable = typeof HTMLCanvasElement.prototype.transferControlToOffscreen !== 'function';
  const validation = useMemo(() => validateSequence(text), [text]);
  const container = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worker = useRef<Worker | null>(null);
  const currentRequest = useRef(0);
  const sentSequence = useRef('');
  const sentWindow = useRef<HydropathyWindow>(9);

  useEffect(() => {
    try {
      const instance = new Worker(new URL('./profile.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<ProfileResponse>) => {
        if (event.data.id !== currentRequest.current) return;
        if (event.data.error) {
          setError(event.data.error);
          return;
        }
        setProfile({
          sequence: sentSequence.current,
          windowSize: sentWindow.current,
          points: event.data.points ?? [],
          propensities: event.data.propensities ?? [],
        });
        setPage(0);
        setError(null);
      };
      instance.onerror = () => { setError('El hilo de la gráfica dejó de responder.'); };

      const canvas = document.createElement('canvas');
      canvas.className = 'hydropathy-chart';
      canvas.setAttribute('aria-hidden', 'true');
      container.current?.append(canvas);
      canvasRef.current = canvas;
      if (typeof canvas.transferControlToOffscreen === 'function') {
        const transferred = canvas.transferControlToOffscreen();
        const message: ProfileRequest = {
          type: 'initialize',
          canvas: transferred,
          style: getChartStyle(canvas),
        };
        instance.postMessage(message, [transferred]);
      }
    } catch {
      queueMicrotask(() => { setError('No se pudo iniciar el hilo del perfil.'); });
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
      canvasRef.current?.remove();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    currentRequest.current += 1;
    if (validation.invalidPositions.length > 0 || validation.sequence.length === 0) return;
    const send = () => {
      const canvas = canvasRef.current;
      if (!canvas || !worker.current) return;
      const id = ++currentRequest.current;
      sentSequence.current = validation.sequence;
      sentWindow.current = windowSize;
      const rectangle = canvas.getBoundingClientRect();
      const request: ProfileRequest = {
        type: 'calculate',
        id,
        sequence: validation.sequence,
        windowSize,
        width: Math.max(1, rectangle.width),
        height: Math.max(1, rectangle.height),
        scale: Math.max(1, window.devicePixelRatio || 1),
        style: getChartStyle(canvas),
      };
      worker.current.postMessage(request);
    };
    send();
    window.addEventListener('resize', send);
    return () => { window.removeEventListener('resize', send); };
  }, [validation, windowSize]);

  const invalid = validation.invalidPositions.length > 0;
  const tooShort = !invalid && validation.sequence.length > 0 && validation.sequence.length < windowSize;
  const current = !invalid && profile?.sequence === validation.sequence
    && profile.windowSize === windowSize;
  const points = invalid ? (profile?.points ?? []) : current ? profile.points : [];
  const propensities = invalid ? (profile?.propensities ?? []) : current ? profile.propensities : [];
  const hydropathyByResidue = new Map(points.map((point) => [point.position, point.value]));
  const displayedWindow = invalid ? (profile?.windowSize ?? windowSize) : windowSize;
  const totalPages = Math.ceil(propensities.length / ROWS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const rows = propensities.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);

  return (
    <section aria-labelledby="profile-title" className="profile-panel">
      <h2 id="profile-title">Perfil de hidrofobicidad</h2>
      <label htmlFor="hydropathy-window">Ventana de residuos</label>
      <select
        id="hydropathy-window"
        value={windowSize}
        onChange={(event) => { setWindowSize(Number(event.target.value) as HydropathyWindow); }}
      >
        <option value="9">9 — regiones superficiales</option>
        <option value="19">19 — segmentos transmembrana</option>
      </select>
      <p>Escala Kyte–Doolittle; media de ventana completa, sin normalización. El valor corresponde al residuo central.</p>
      <p>
        Propensiones de Chou–Fasman (1978): estimación clásica de baja precisión; no es una predicción de estructura.
        Parámetros publicados por ProtScale para{' '}
        <a href="https://web.expasy.org/protscale/pscale/alpha-helixFasman.html">hélice</a>,{' '}
        <a href="https://web.expasy.org/protscale/pscale/beta-sheetFasman.html">lámina</a> y{' '}
        <a href="https://web.expasy.org/protscale/pscale/beta-turnFasman.html">giro</a>.
      </p>
      <p id="profile-status" role="status" aria-live="polite">
        {invalid && 'El perfil y las propensiones están desactualizados. Corrige las posiciones inválidas para recalcular.'}
        {tooShort && `Se necesitan al menos ${String(windowSize)} residuos para mostrar la gráfica; las propensiones siguen disponibles.`}
        {!invalid && !tooShort && validation.sequence.length === 0 && 'Escribe una secuencia válida para mostrar el perfil.'}
        {!invalid && !tooShort && validation.sequence.length > 0 && !current && !error && 'Calculando perfil y propensiones…'}
        {error && !invalid && error}
        {chartUnavailable && current && !tooShort && 'Este navegador no permite transferir el lienzo; consulta los valores en la tabla.'}
      </p>
      <div
        className={invalid ? 'stale-chart' : !current ? 'pending-chart' : undefined}
        hidden={tooShort || validation.sequence.length === 0 || chartUnavailable}
      >
        <div ref={container} className="chart-container" />
      </div>
      {propensities.length > 0 && (
        <div className={invalid ? 'stale-table' : undefined}>
          <div className="profile-table-container">
            <table>
              <caption>Hidropatía y propensiones por residuo, ventana de {displayedWindow} residuos</caption>
              <thead><tr><th scope="col">Posición</th><th scope="col">Residuo</th><th scope="col">Hidropatía</th><th scope="col">Hélice</th><th scope="col">Lámina</th><th scope="col">Giro</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.position}>
                    <th scope="row">{row.position}</th>
                    <td>{row.residue}</td>
                    <td>{hydropathyByResidue.has(row.position)
                      ? hydropathyByResidue.get(row.position) === null
                        ? 'Sin dato'
                        : VALUE_FORMAT.format(hydropathyByResidue.get(row.position) ?? 0)
                      : <span aria-label="Sin ventana completa">—</span>}</td>
                    <td>{row.helix === null ? 'Sin dato' : VALUE_FORMAT.format(row.helix)}</td>
                    <td>{row.sheet === null ? 'Sin dato' : VALUE_FORMAT.format(row.sheet)}</td>
                    <td>{row.turn === null ? 'Sin dato' : VALUE_FORMAT.format(row.turn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav aria-label="Páginas de valores del perfil" className="profile-pages">
              <button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); }}>Anterior</button>
              <span aria-live="polite">Página {currentPage + 1} de {totalPages}</span>
              <button type="button" disabled={currentPage + 1 >= totalPages} onClick={() => { setPage(currentPage + 1); }}>Siguiente</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
