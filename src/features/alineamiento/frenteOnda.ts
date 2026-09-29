import { bordeInicial, calcularBloque } from './bloque';
import type { ResultadoBloque, SolicitudBloque } from './bloque';
import { construirResultado, normalizarParaAlineamiento } from './gotoh';
import type { Matriz, Modo, ResultadoAlineamiento } from './gotoh';

export const LADO_BLOQUE = 256;
export const MAX_RESIDUOS_ALINEAMIENTO = 5000;

export interface OpcionesFrenteOnda {
  matriz: Matriz;
  modo: Modo;
  progreso?: (fraccion: number) => void;
  cancelado?: () => boolean;
  ejecutarLote?: (solicitudes: SolicitudBloque[]) => Promise<ResultadoBloque[]>;
  memoriaCompartida?: boolean;
}

/** Recorre teselas por antidiagonales y deja el traceback en un byte por celda. */
export async function alinearPorBloques(
  primera: string,
  segunda: string,
  opciones: OpcionesFrenteOnda,
): Promise<ResultadoAlineamiento> {
  const a = normalizarParaAlineamiento(primera).secuencia;
  const b = normalizarParaAlineamiento(segunda).secuencia;
  if (a.length > MAX_RESIDUOS_ALINEAMIENTO || b.length > MAX_RESIDUOS_ALINEAMIENTO) {
    throw new RangeError(`Cada secuencia admite como máximo ${String(MAX_RESIDUOS_ALINEAMIENTO)} residuos.`);
  }
  const filas = Math.ceil(a.length / LADO_BLOQUE);
  const columnas = Math.ceil(b.length / LADO_BLOQUE);
  const resultados: (ResultadoBloque | undefined)[][] = Array.from({ length: filas }, () => Array<ResultadoBloque | undefined>(columnas));
  const longitudTraza = (a.length + 1) * (b.length + 1);
  const buffer = opciones.memoriaCompartida ? new SharedArrayBuffer(longitudTraza) : new ArrayBuffer(longitudTraza);
  const ejecutar = opciones.ejecutarLote ?? ((solicitudes: SolicitudBloque[]) => Promise.resolve(solicitudes.map(calcularBloque)));
  let mejor = { puntuacion: 0, i: 0, j: opciones.modo === 'global' ? b.length : 0, estado: 0 };
  let procesadas = 0;
  opciones.progreso?.(0);

  for (let diagonal = 0; diagonal < filas + columnas - 1; diagonal += 1) {
    const lote: SolicitudBloque[] = [];
    for (let indiceFila = Math.max(0, diagonal - columnas + 1); indiceFila <= Math.min(filas - 1, diagonal); indiceFila += 1) {
      const indiceColumna = diagonal - indiceFila;
      const fila = indiceFila * LADO_BLOQUE;
      const columna = indiceColumna * LADO_BLOQUE;
      const alto = Math.min(LADO_BLOQUE, a.length - fila);
      const ancho = Math.min(LADO_BLOQUE, b.length - columna);
      const superior = indiceFila === 0 ? bordeInicial(ancho) : resultados[indiceFila - 1]?.[indiceColumna]?.inferior;
      const izquierdo = indiceColumna === 0 ? bordeInicial(alto) : resultados[indiceFila]?.[indiceColumna - 1]?.derecho;
      if (!superior || !izquierdo) throw new Error('Falta una frontera del frente de onda.');
      lote.push({ fila, columna, alto, ancho, primera: a, segunda: b, matriz: opciones.matriz,
        modo: opciones.modo, superior, izquierdo, traza: buffer });
    }
    for (const resultado of await ejecutar(lote)) {
      const indiceFila = Math.floor(resultado.fila / LADO_BLOQUE);
      const indiceColumna = Math.floor(resultado.columna / LADO_BLOQUE);
      if (!resultados[indiceFila]) throw new Error('Índice de bloque fuera de rango.');
      resultados[indiceFila][indiceColumna] = resultado;
      if (resultado.mejor.puntuacion > mejor.puntuacion) mejor = resultado.mejor;
      procesadas += Math.min(LADO_BLOQUE, a.length - resultado.fila) * Math.min(LADO_BLOQUE, b.length - resultado.columna);
    }
    opciones.progreso?.(procesadas / (a.length * b.length));
    await new Promise<void>((resolver) => { setTimeout(resolver, 0); });
    if (opciones.cancelado?.()) throw new Error('Alineamiento cancelado.');
  }
  return construirResultado(a, b, opciones.matriz, opciones.modo, new Uint8Array(buffer), mejor);
}
