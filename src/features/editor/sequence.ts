/** Residuos admitidos en el editor; los ambiguos conservan su posición original. */
export const AMINOACIDOS_ESTANDAR = 'ACDEFGHIKLMNPQRSTVWY';
export const AMINOACIDOS_ADICIONALES = 'UOBZX';
const AMINOACIDOS = new Set(AMINOACIDOS_ESTANDAR + AMINOACIDOS_ADICIONALES);

export interface ResultadoValidacion {
  posicionesInvalidas: number[];
  secuencia: string;
}

/** Valida una secuencia sin depender de React ni del navegador. Las posiciones son índices del texto original. */
export function validarSecuencia(texto: string): ResultadoValidacion {
  const posicionesInvalidas: number[] = [];
  const residuos: string[] = [];
  const ultimoResiduo = texto.search(/\*?[\r\n]*$/);

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caracter = texto[indice];
    if (caracter === '\n' || caracter === '\r' || (caracter === '*' && indice === ultimoResiduo)) continue;
    const codigo = caracter?.charCodeAt(0) ?? -1;
    const mayuscula = codigo >= 97 && codigo <= 122
      ? String.fromCharCode(codigo - 32)
      : caracter ?? '';
    if (AMINOACIDOS.has(mayuscula)) {
      residuos.push(mayuscula);
    } else {
      posicionesInvalidas.push(indice);
    }
  }

  return { posicionesInvalidas, secuencia: residuos.join('') };
}

/** Extrae los residuos con parámetros fisicoquímicos definidos y cuenta los excluidos. */
export function separarResiduosEstandar(secuencia: string): { estandar: string; excluidos: number } {
  let estandar = '';
  let excluidos = 0;
  for (const residuo of secuencia) {
    if (AMINOACIDOS_ESTANDAR.includes(residuo)) estandar += residuo;
    else excluidos += 1;
  }
  return { estandar, excluidos };
}

/** Revalida solo el tramo modificado y desplaza las posiciones posteriores. */
export function actualizarPosicionesInvalidas(
  anterior: string,
  siguiente: string,
  posicionesAnteriores: readonly number[],
): number[] {
  let inicio = 0;
  while (inicio < anterior.length && inicio < siguiente.length && anterior[inicio] === siguiente[inicio]) {
    inicio += 1;
  }

  let finAnterior = anterior.length;
  let finSiguiente = siguiente.length;
  while (finAnterior > inicio && finSiguiente > inicio && anterior[finAnterior - 1] === siguiente[finSiguiente - 1]) {
    finAnterior -= 1;
    finSiguiente -= 1;
  }

  const desplazamiento = finSiguiente - finAnterior;
  const conservadasAntes = posicionesAnteriores.filter((posicion) => posicion < inicio);
  const cambiadas = validarSecuencia(siguiente.slice(inicio, finSiguiente)).posicionesInvalidas.map(
    (posicion) => posicion + inicio,
  );
  const conservadasDespues = posicionesAnteriores
    .filter((posicion) => posicion >= finAnterior)
    .map((posicion) => posicion + desplazamiento);

  return [...conservadasAntes, ...cambiadas, ...conservadasDespues];
}
