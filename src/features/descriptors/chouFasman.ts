/** Propensiones clásicas Chou–Fasman (1978), sin asignación de estructura. */
export interface PropensionResiduo {
  posicion: number;
  residuo: string;
  helice: number | null;
  lamina: number | null;
  giro: number | null;
}

// Parámetros de Chou y Fasman, Adv. Enzymol. 47:45–148 (1978), publicados por ExPASy ProtScale.
const PARAMETROS: Readonly<Record<string, readonly [number, number, number]>> = {
  A: [1.42, 0.83, 0.66], C: [0.70, 1.19, 1.19], D: [1.01, 0.54, 1.46],
  E: [1.51, 0.37, 0.74], F: [1.13, 1.38, 0.60], G: [0.57, 0.75, 1.56],
  H: [1.00, 0.87, 0.95], I: [1.08, 1.60, 0.47], K: [1.16, 0.74, 1.01],
  L: [1.21, 1.30, 0.59], M: [1.45, 1.05, 0.60], N: [0.67, 0.89, 1.56],
  P: [0.57, 0.55, 1.52], Q: [1.11, 1.10, 0.98], R: [0.98, 0.93, 0.95],
  S: [0.77, 0.75, 1.43], T: [0.83, 1.19, 0.96], V: [1.06, 1.70, 0.50],
  W: [1.08, 1.37, 0.96], Y: [0.69, 1.47, 1.14],
};

/** Devuelve las tres propensiones para todos los residuos de una secuencia válida. */
export function calcularPropensiones(secuencia: string): PropensionResiduo[] {
  if (secuencia.length === 0 || /[^ACDEFGHIKLMNPQRSTVWYUOBZX]/.test(secuencia)) {
    throw new RangeError('La secuencia contiene caracteres no admitidos.');
  }
  return Array.from(secuencia, (residuo, indice) => {
    const parametros = PARAMETROS[residuo];
    return {
      posicion: indice + 1,
      residuo,
      helice: parametros?.[0] ?? null,
      lamina: parametros?.[1] ?? null,
      giro: parametros?.[2] ?? null,
    };
  });
}
