import { useEffect, useMemo, useRef, useState } from 'react';
import { validarSecuencia } from '../editor/secuencia';
import { obtenerEstiloGrafica } from './estiloGrafica';
import type { RespuestaPerfil, SolicitudPerfil } from './mensajesPerfil';
import type { PuntoPerfil, VentanaHidropatia } from './perfil';
import type { PropensionResiduo } from './chouFasman';

const FILAS_POR_PAGINA = 50;
const FORMATO_VALOR = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

interface PerfilRecibido {
  secuencia: string;
  ventana: VentanaHidropatia;
  puntos: PuntoPerfil[];
  propensiones: PropensionResiduo[];
}

/** Perfil dibujado fuera del hilo principal y tabla navegable de sus valores. */
export function PerfilHidrofobicidad({ texto }: { texto: string }): React.JSX.Element {
  const [ventana, setVentana] = useState<VentanaHidropatia>(9);
  const [perfil, setPerfil] = useState<PerfilRecibido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const sinGrafica = typeof HTMLCanvasElement.prototype.transferControlToOffscreen !== 'function';
  const validacion = useMemo(() => validarSecuencia(texto), [texto]);
  const contenedor = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const hilo = useRef<Worker | null>(null);
  const peticionActual = useRef(0);
  const secuenciaEnviada = useRef('');
  const ventanaEnviada = useRef<VentanaHidropatia>(9);

  useEffect(() => {
    try {
      const instancia = new Worker(new URL('./perfil.worker.ts', import.meta.url), { type: 'module' });
      hilo.current = instancia;
      instancia.onmessage = (evento: MessageEvent<RespuestaPerfil>) => {
        if (evento.data.id !== peticionActual.current) return;
        if (evento.data.error) {
          setError(evento.data.error);
          return;
        }
        setPerfil({
          secuencia: secuenciaEnviada.current,
          ventana: ventanaEnviada.current,
          puntos: evento.data.puntos ?? [],
          propensiones: evento.data.propensiones ?? [],
        });
        setPagina(0);
        setError(null);
      };
      instancia.onerror = () => { setError('El hilo de la gráfica dejó de responder.'); };

      const canvas = document.createElement('canvas');
      canvas.className = 'grafica-hidrofobicidad';
      canvas.setAttribute('aria-hidden', 'true');
      contenedor.current?.append(canvas);
      lienzo.current = canvas;
      if (typeof canvas.transferControlToOffscreen === 'function') {
        const transferido = canvas.transferControlToOffscreen();
        const mensaje: SolicitudPerfil = {
          tipo: 'iniciar',
          lienzo: transferido,
          estilo: obtenerEstiloGrafica(canvas),
        };
        instancia.postMessage(mensaje, [transferido]);
      }
    } catch {
      queueMicrotask(() => { setError('No se pudo iniciar el hilo del perfil.'); });
    }
    return () => {
      hilo.current?.terminate();
      hilo.current = null;
      lienzo.current?.remove();
      lienzo.current = null;
    };
  }, []);

  useEffect(() => {
    peticionActual.current += 1;
    if (validacion.posicionesInvalidas.length > 0 || validacion.secuencia.length === 0) return;
    const enviar = () => {
      const canvas = lienzo.current;
      if (!canvas || !hilo.current) return;
      const id = ++peticionActual.current;
      secuenciaEnviada.current = validacion.secuencia;
      ventanaEnviada.current = ventana;
      const rectangulo = canvas.getBoundingClientRect();
      const solicitud: SolicitudPerfil = {
        tipo: 'calcular',
        id,
        secuencia: validacion.secuencia,
        ventana,
        ancho: Math.max(1, rectangulo.width),
        alto: Math.max(1, rectangulo.height),
        escala: Math.max(1, window.devicePixelRatio || 1),
        estilo: obtenerEstiloGrafica(canvas),
      };
      hilo.current.postMessage(solicitud);
    };
    enviar();
    window.addEventListener('resize', enviar);
    return () => { window.removeEventListener('resize', enviar); };
  }, [validacion, ventana]);

  const invalido = validacion.posicionesInvalidas.length > 0;
  const corto = !invalido && validacion.secuencia.length > 0 && validacion.secuencia.length < ventana;
  const vigente = !invalido && perfil?.secuencia === validacion.secuencia
    && perfil.ventana === ventana;
  const puntos = invalido ? (perfil?.puntos ?? []) : vigente ? perfil.puntos : [];
  const propensiones = invalido ? (perfil?.propensiones ?? []) : vigente ? perfil.propensiones : [];
  const hidropatiaPorResiduo = new Map(puntos.map((punto) => [punto.posicion, punto.valor]));
  const ventanaMostrada = invalido ? (perfil?.ventana ?? ventana) : ventana;
  const totalPaginas = Math.ceil(propensiones.length / FILAS_POR_PAGINA);
  const paginaActual = Math.min(pagina, Math.max(0, totalPaginas - 1));
  const filas = propensiones.slice(paginaActual * FILAS_POR_PAGINA, (paginaActual + 1) * FILAS_POR_PAGINA);

  return (
    <section aria-labelledby="titulo-perfil" className="panel-perfil">
      <h2 id="titulo-perfil">Perfil de hidrofobicidad</h2>
      <label htmlFor="ventana-hidropatia">Ventana de residuos</label>
      <select
        id="ventana-hidropatia"
        value={ventana}
        onChange={(evento) => { setVentana(Number(evento.target.value) as VentanaHidropatia); }}
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
      <p id="estado-perfil" role="status" aria-live="polite">
        {invalido && 'El perfil y las propensiones están desactualizados. Corrige las posiciones inválidas para recalcular.'}
        {corto && `Se necesitan al menos ${String(ventana)} residuos para mostrar la gráfica; las propensiones siguen disponibles.`}
        {!invalido && !corto && validacion.secuencia.length === 0 && 'Escribe una secuencia válida para mostrar el perfil.'}
        {!invalido && !corto && validacion.secuencia.length > 0 && !vigente && !error && 'Calculando perfil y propensiones…'}
        {error && !invalido && error}
        {sinGrafica && vigente && !corto && 'Este navegador no permite transferir el lienzo; consulta los valores en la tabla.'}
      </p>
      <div
        className={invalido ? 'grafica-desactualizada' : !vigente ? 'grafica-esperando' : undefined}
        hidden={corto || validacion.secuencia.length === 0 || sinGrafica}
      >
        <div ref={contenedor} className="contenedor-grafica" />
      </div>
      {propensiones.length > 0 && (
        <div className={invalido ? 'tabla-desactualizada' : undefined}>
          <div className="tabla-perfil-contenedor">
            <table>
              <caption>Hidropatía y propensiones por residuo, ventana de {ventanaMostrada} residuos</caption>
              <thead><tr><th scope="col">Posición</th><th scope="col">Residuo</th><th scope="col">Hidropatía</th><th scope="col">Hélice</th><th scope="col">Lámina</th><th scope="col">Giro</th></tr></thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.posicion}>
                    <th scope="row">{fila.posicion}</th>
                    <td>{fila.residuo}</td>
                    <td>{hidropatiaPorResiduo.has(fila.posicion)
                      ? hidropatiaPorResiduo.get(fila.posicion) === null
                        ? 'Sin dato'
                        : FORMATO_VALOR.format(hidropatiaPorResiduo.get(fila.posicion) ?? 0)
                      : <span aria-label="Sin ventana completa">—</span>}</td>
                    <td>{fila.helice === null ? 'Sin dato' : FORMATO_VALOR.format(fila.helice)}</td>
                    <td>{fila.lamina === null ? 'Sin dato' : FORMATO_VALOR.format(fila.lamina)}</td>
                    <td>{fila.giro === null ? 'Sin dato' : FORMATO_VALOR.format(fila.giro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <nav aria-label="Páginas de valores del perfil" className="paginas-perfil">
              <button type="button" disabled={paginaActual === 0} onClick={() => { setPagina(paginaActual - 1); }}>Anterior</button>
              <span aria-live="polite">Página {paginaActual + 1} de {totalPaginas}</span>
              <button type="button" disabled={paginaActual + 1 >= totalPaginas} onClick={() => { setPagina(paginaActual + 1); }}>Siguiente</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
