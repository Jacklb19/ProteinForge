import type { EstadoDescriptores } from './useDescriptors';

const DOS_DECIMALES = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const TRES_DECIMALES = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3, minimumFractionDigits: 3 });

/** Presenta los cinco descriptores y señala resultados desactualizados. */
export function PanelDescriptores({ datos }: { datos: EstadoDescriptores }): React.JSX.Element {
  const { resultado, estado, error, excluidos } = datos;
  const desactualizado = resultado !== null && estado !== 'actual';
  return (
    <section aria-labelledby="titulo-descriptores" className="panel-descriptores">
      <h2 id="titulo-descriptores">Descriptores fisicoquímicos</h2>
      {excluidos > 0 && <p role="note">{excluidos} residuo{excluidos === 1 ? '' : 's'} U, O, B, Z o X excluido{excluidos === 1 ? '' : 's'} de los descriptores.</p>}
      <p role="status" aria-live="polite">
        {estado === 'invalido' && 'Los resultados están desactualizados. Corrige las posiciones inválidas para recalcular.'}
        {estado === 'calculando' && 'Calculando descriptores…'}
        {estado === 'error' && (error ?? 'No se pudieron calcular los descriptores.')}
        {estado === 'vacio' && (excluidos > 0 ? 'No hay residuos estándar para calcular descriptores.' : 'Escribe una secuencia válida para iniciar el análisis.')}
      </p>
      {resultado && (
        <dl className={desactualizado ? 'descriptores-desactualizados' : undefined}>
          <div><dt>Masa molecular</dt><dd>{DOS_DECIMALES.format(resultado.masaDa)} Da</dd></div>
          <div><dt>Punto isoeléctrico</dt><dd>{DOS_DECIMALES.format(resultado.puntoIsoelectrico)}</dd></div>
          <div><dt>Índice de inestabilidad</dt><dd>{DOS_DECIMALES.format(resultado.indiceInestabilidad)}</dd></div>
          <div><dt>Índice alifático</dt><dd>{DOS_DECIMALES.format(resultado.indiceAlifatico)}</dd></div>
          <div><dt>GRAVY</dt><dd>{TRES_DECIMALES.format(resultado.gravy)}</dd></div>
        </dl>
      )}
    </section>
  );
}
