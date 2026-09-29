import type { DescriptorState } from './useDescriptors';

const TWO_DECIMALS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const THREE_DECIMALS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3, minimumFractionDigits: 3 });

/** Displays five descriptors and marks stale results. */
export function DescriptorPanel({ data }: { data: DescriptorState }): React.JSX.Element {
  const { result, status, error, excluded } = data;
  const stale = result !== null && status !== 'current';
  return (
    <section aria-labelledby="descriptors-title" className="descriptor-panel">
      <h2 id="descriptors-title">Descriptores fisicoquímicos</h2>
      {excluded > 0 && <p role="note">{excluded} residuo{excluded === 1 ? '' : 's'} U, O, B, Z o X excluido{excluded === 1 ? '' : 's'} de los descriptores.</p>}
      <p role="status" aria-live="polite">
        {status === 'invalid' && 'Los resultados están desactualizados. Corrige las posiciones inválidas para recalcular.'}
        {status === 'calculating' && 'Calculando descriptores…'}
        {status === 'error' && (error ?? 'No se pudieron calcular los descriptores.')}
        {status === 'empty' && (excluded > 0 ? 'No hay residuos estándar para calcular descriptores.' : 'Escribe una secuencia válida para iniciar el análisis.')}
      </p>
      {result && (
        <dl className={stale ? 'stale-descriptors' : undefined}>
          <div><dt>Masa molecular</dt><dd>{TWO_DECIMALS.format(result.massDa)} Da</dd></div>
          <div><dt>Punto isoeléctrico</dt><dd>{TWO_DECIMALS.format(result.isoelectricPoint)}</dd></div>
          <div><dt>Índice de inestabilidad</dt><dd>{TWO_DECIMALS.format(result.instabilityIndex)}</dd></div>
          <div><dt>Índice alifático</dt><dd>{TWO_DECIMALS.format(result.aliphaticIndex)}</dd></div>
          <div><dt>GRAVY</dt><dd>{THREE_DECIMALS.format(result.gravy)}</dd></div>
        </dl>
      )}
    </section>
  );
}
