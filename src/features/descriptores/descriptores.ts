import { PESOS_DIPEPTIDOS } from './dipeptidos';

/** Resultados calculados sobre una secuencia completa de veinte aminoácidos estándar. */
export interface Descriptores {
  masaDa: number;
  puntoIsoelectrico: number;
  indiceInestabilidad: number;
  indiceAlifatico: number;
  gravy: number;
  longitud: number;
}

/** Masas promedio de residuos y agua de ExPASy FindMod, en daltons. */
const MASA_RESIDUO: Record<string, number> = {
  A: 71.0788, C: 103.1388, D: 115.0886, E: 129.1155, F: 147.1766,
  G: 57.0519, H: 137.1411, I: 113.1594, K: 128.1741, L: 113.1594,
  M: 131.1926, N: 114.1038, P: 97.1167, Q: 128.1307, R: 156.1875,
  S: 87.0782, T: 101.1051, V: 99.1326, W: 186.2132, Y: 163.1760,
};
const MASA_AGUA = 18.01524;

/** Escala de hidropatía Kyte–Doolittle (1982), compartida con el perfil. */
export const HIDROPATIA: Readonly<Record<string, number>> = {
  A: 1.8, C: 2.5, D: -3.5, E: -3.5, F: 2.8,
  G: -0.4, H: -3.2, I: 4.5, K: -3.9, L: 3.8,
  M: 1.9, N: -3.5, P: -1.6, Q: -3.5, R: -4.5,
  S: -0.8, T: -0.7, V: 4.2, W: -0.9, Y: -1.3,
};

const PKA_POSITIVOS: Record<string, number> = { K: 10, R: 12, H: 5.98 };
const PKA_NEGATIVOS: Record<string, number> = { D: 4.05, E: 4.45, C: 9, Y: 10 };
const PKA_N_TERMINAL: Record<string, number> = {
  A: 7.59, M: 7, S: 6.93, P: 8.36, T: 6.82, V: 7.44, E: 7.7,
};
const PKA_C_TERMINAL: Record<string, number> = { D: 4.55, E: 4.75 };

function cargaEnPh(
  ph: number,
  conteos: Readonly<Record<string, number>>,
  pkN: number,
  pkC: number,
): number {
  let carga = 1 / (1 + 10 ** (ph - pkN)) - 1 / (1 + 10 ** (pkC - ph));
  for (const [residuo, pk] of Object.entries(PKA_POSITIVOS)) {
    carga += (conteos[residuo] ?? 0) / (1 + 10 ** (ph - pk));
  }
  for (const [residuo, pk] of Object.entries(PKA_NEGATIVOS)) {
    carga -= (conteos[residuo] ?? 0) / (1 + 10 ** (pk - ph));
  }
  return carga;
}

function puntoIsoelectrico(secuencia: string, conteos: Readonly<Record<string, number>>): number {
  const pkN = PKA_N_TERMINAL[secuencia[0] ?? ''] ?? 7.5;
  const pkC = PKA_C_TERMINAL[secuencia.at(-1) ?? ''] ?? 3.55;
  let minimo = 4.05;
  let maximo = 12;
  while (maximo - minimo > 0.0001) {
    const medio = (minimo + maximo) / 2;
    if (cargaEnPh(medio, conteos, pkN, pkC) > 0) minimo = medio;
    else maximo = medio;
  }
  return (minimo + maximo) / 2;
}

/** Calcula los cinco descriptores de RF-03; rechaza entradas vacías o inválidas. */
export function calcularDescriptores(secuencia: string): Descriptores {
  if (secuencia.length === 0 || /[^ACDEFGHIKLMNPQRSTVWY]/.test(secuencia)) {
    throw new RangeError('La secuencia debe contener solo aminoácidos estándar en mayúsculas.');
  }

  const conteos: Record<string, number> = {};
  let masaDa = MASA_AGUA;
  let sumaHidropatia = 0;
  let sumaInestabilidad = 0;
  for (let indice = 0; indice < secuencia.length; indice += 1) {
    const residuo = secuencia[indice] ?? '';
    conteos[residuo] = (conteos[residuo] ?? 0) + 1;
    masaDa += MASA_RESIDUO[residuo] ?? 0;
    sumaHidropatia += HIDROPATIA[residuo] ?? 0;
    if (indice + 1 < secuencia.length) {
      const siguiente = secuencia[indice + 1] ?? '';
      sumaInestabilidad += PESOS_DIPEPTIDOS[residuo]?.[siguiente] ?? 0;
    }
  }
  const longitud = secuencia.length;
  return {
    masaDa,
    puntoIsoelectrico: puntoIsoelectrico(secuencia, conteos),
    indiceInestabilidad: (10 * sumaInestabilidad) / longitud,
    indiceAlifatico: (100 * ((conteos.A ?? 0) + 2.9 * (conteos.V ?? 0)
      + 3.9 * ((conteos.I ?? 0) + (conteos.L ?? 0)))) / longitud,
    gravy: sumaHidropatia / longitud,
    longitud,
  };
}
