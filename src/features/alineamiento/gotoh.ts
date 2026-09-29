import blosum from './fixtures/blosum.json';

/** Matrices de sustitución disponibles para alineamiento proteico. */
export type Matriz = 'BLOSUM45' | 'BLOSUM62' | 'BLOSUM80';
export type Modo = 'global' | 'local';

/** Parámetros completos que acompañan cada resultado reproducible. */
export interface ParametrosAlineamiento {
  matriz: Matriz;
  modo: Modo;
  apertura: 10;
  extension: 0.5;
  extremos: 'libres' | 'no-aplica';
}

/** Secuencias alineadas y métricas expresadas también como valores numéricos. */
export interface ResultadoAlineamiento {
  primeraAlineada: string;
  segundaAlineada: string;
  marcas: string;
  puntuacion: number;
  identidades: number;
  similitudes: number;
  columnas: number;
  parametros: ParametrosAlineamiento;
}

export interface OpcionesAlineamiento {
  matriz?: Matriz;
  modo?: Modo;
  progreso?: (fraccion: number) => void;
  cancelado?: () => boolean;
}

const ALFABETO = blosum.alfabeto;
const APERTURA = 10;
const EXTENSION = 0.5;
const M = 0;
const X = 1;
const Y = 2;
const PARADA = 3;

/** Reemplaza selenocisteína y pirrolisina solo para puntuar el alineamiento. */
export function normalizarParaAlineamiento(secuencia: string): { secuencia: string; avisos: string[] } {
  const avisos: string[] = [];
  if (secuencia.includes('U')) avisos.push('U se puntúa como C.');
  if (secuencia.includes('O')) avisos.push('O se puntúa como K.');
  const normalizada = secuencia.replaceAll('U', 'C').replaceAll('O', 'K');
  if (Array.from(normalizada).some((residuo) => !ALFABETO.includes(residuo))) {
    throw new RangeError('La secuencia de alineamiento contiene caracteres no admitidos.');
  }
  if (normalizada.length === 0) throw new RangeError('Las dos secuencias deben contener residuos.');
  return { secuencia: normalizada, avisos };
}

/** Bytes de traceback y seis filas de puntuaciones Float32 para dos longitudes. */
export function memoriaCaminoVuelta(longitudPrimera: number, longitudSegunda: number): number {
  const ancho = longitudSegunda + 1;
  return (longitudPrimera + 1) * ancho + 6 * ancho * Float32Array.BYTES_PER_ELEMENT;
}

function marcasDe(primera: string, segunda: string, matriz: number[][]): string {
  let marcas = '';
  for (let indice = 0; indice < primera.length; indice += 1) {
    const a = primera[indice] ?? '-';
    const b = segunda[indice] ?? '-';
    if (a === '-' || b === '-') marcas += ' ';
    else if (a === b) marcas += '|';
    else marcas += (matriz[ALFABETO.indexOf(a)]?.[ALFABETO.indexOf(b)] ?? 0) > 0 ? ':' : ' ';
  }
  return marcas;
}

/** Reconstruye las columnas y métricas a partir del traceback compacto. */
export function construirResultado(
  a: string,
  b: string,
  matriz: Matriz,
  modo: Modo,
  traza: Uint8Array,
  mejor: { puntuacion: number; i: number; j: number; estado: number },
): ResultadoAlineamiento {
  const ancho = b.length + 1;
  const alineadaA: string[] = [];
  const alineadaB: string[] = [];
  if (modo === 'global') {
    for (let i = a.length; i > mejor.i; i -= 1) { alineadaA.push(a[i - 1] ?? ''); alineadaB.push('-'); }
    for (let j = b.length; j > mejor.j; j -= 1) { alineadaA.push('-'); alineadaB.push(b[j - 1] ?? ''); }
  }
  let i = mejor.i;
  let j = mejor.j;
  let estado = mejor.estado;
  while (i > 0 && j > 0) {
    const codigo = traza[i * ancho + j] ?? 0;
    if (estado === M) {
      if (modo === 'local' && (codigo & 3) === PARADA) break;
      alineadaA.push(a[i - 1] ?? '');
      alineadaB.push(b[j - 1] ?? '');
      i -= 1;
      j -= 1;
      estado = codigo & 3;
    } else if (estado === X) {
      alineadaA.push(a[i - 1] ?? '');
      alineadaB.push('-');
      i -= 1;
      estado = codigo & 4 ? X : M;
    } else {
      alineadaA.push('-');
      alineadaB.push(b[j - 1] ?? '');
      j -= 1;
      estado = codigo & 8 ? Y : M;
    }
  }
  if (modo === 'global') {
    while (i > 0) { alineadaA.push(a[--i] ?? ''); alineadaB.push('-'); }
    while (j > 0) { alineadaA.push('-'); alineadaB.push(b[--j] ?? ''); }
  }
  const primeraAlineada = alineadaA.reverse().join('');
  const segundaAlineada = alineadaB.reverse().join('');
  const marcas = marcasDe(primeraAlineada, segundaAlineada, blosum.valores[matriz]);
  return {
    primeraAlineada,
    segundaAlineada,
    marcas,
    puntuacion: mejor.puntuacion,
    identidades: Array.from(marcas).filter((marca) => marca === '|').length,
    similitudes: Array.from(marcas).filter((marca) => marca === '|' || marca === ':').length,
    columnas: marcas.length,
    parametros: { matriz, modo, apertura: 10, extension: 0.5, extremos: modo === 'global' ? 'libres' : 'no-aplica' },
  };
}

/** Ejecuta Gotoh con filas reutilizadas y un byte de traceback por celda. */
export async function alinearSecuencias(
  primera: string,
  segunda: string,
  opciones: OpcionesAlineamiento = {},
): Promise<ResultadoAlineamiento> {
  const matriz = opciones.matriz ?? 'BLOSUM62';
  const modo = opciones.modo ?? 'global';
  if (!['BLOSUM45', 'BLOSUM62', 'BLOSUM80'].includes(matriz) || !['global', 'local'].includes(modo)) {
    throw new RangeError('Los parámetros de alineamiento no están admitidos.');
  }
  const a = normalizarParaAlineamiento(primera).secuencia;
  const b = normalizarParaAlineamiento(segunda).secuencia;
  const ancho = b.length + 1;
  const traza = new Uint8Array((a.length + 1) * ancho);
  let previoM = new Float32Array(ancho);
  let previoX = new Float32Array(ancho).fill(Number.NEGATIVE_INFINITY);
  let previoY = new Float32Array(ancho).fill(Number.NEGATIVE_INFINITY);
  let actualM = new Float32Array(ancho);
  let actualX = new Float32Array(ancho);
  let actualY = new Float32Array(ancho);
  const valores = blosum.valores[matriz];
  let mejor = 0;
  let mejorI = 0;
  let mejorJ = modo === 'global' ? b.length : 0;
  let mejorEstado = M;

  for (let i = 1; i <= a.length; i += 1) {
    actualM[0] = 0;
    actualX[0] = Number.NEGATIVE_INFINITY;
    actualY[0] = Number.NEGATIVE_INFINITY;
    const fila = valores[ALFABETO.indexOf(a[i - 1] ?? '')] ?? [];
    for (let j = 1; j <= b.length; j += 1) {
      const indice = i * ancho + j;
      let diagonal = previoM[j - 1] ?? 0;
      let origenM = M;
      if ((previoX[j - 1] ?? -Infinity) > diagonal) {
        diagonal = previoX[j - 1] ?? -Infinity;
        origenM = X;
      }
      if ((previoY[j - 1] ?? -Infinity) > diagonal) {
        diagonal = previoY[j - 1] ?? -Infinity;
        origenM = Y;
      }
      let valorM = diagonal + (fila[ALFABETO.indexOf(b[j - 1] ?? '')] ?? -Infinity);
      if (modo === 'local' && valorM <= 0) {
        valorM = 0;
        origenM = PARADA;
      }
      const abreX = (previoM[j] ?? -Infinity) - APERTURA;
      const extiendeX = (previoX[j] ?? -Infinity) - EXTENSION;
      const abreY = (actualM[j - 1] ?? -Infinity) - APERTURA;
      const extiendeY = (actualY[j - 1] ?? -Infinity) - EXTENSION;
      actualM[j] = valorM;
      actualX[j] = Math.max(abreX, extiendeX);
      actualY[j] = Math.max(abreY, extiendeY);
      traza[indice] = origenM | (extiendeX > abreX ? 4 : 0) | (extiendeY > abreY ? 8 : 0);
      if (modo === 'local' || i === a.length || j === b.length) {
        const candidatos: [number, number][] = [[M, valorM], [X, actualX[j] ?? -Infinity], [Y, actualY[j] ?? -Infinity]];
        for (const [estado, valor] of candidatos) {
          if (valor > mejor) {
            mejor = valor;
            mejorI = i;
            mejorJ = j;
            mejorEstado = estado;
          }
        }
      }
    }
    [previoM, actualM] = [actualM, previoM];
    [previoX, actualX] = [actualX, previoX];
    [previoY, actualY] = [actualY, previoY];
    if (i % 64 === 0 || i === a.length) {
      opciones.progreso?.(i / a.length);
      await new Promise<void>((resolver) => { setTimeout(resolver, 0); });
      if (opciones.cancelado?.()) throw new Error('Alineamiento cancelado.');
    }
  }

  return construirResultado(a, b, matriz, modo, traza, {
    puntuacion: mejor,
    i: mejorI,
    j: mejorJ,
    estado: mejorEstado,
  });
}
