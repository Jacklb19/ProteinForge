import blosum from './fixtures/blosum.json';
import type { Matriz, Modo } from './gotoh';

/** Frontera de las tres matrices de Gotoh para una fila o columna de un bloque. */
export interface Borde {
  m: Float32Array;
  x: Float32Array;
  y: Float32Array;
}

export interface SolicitudBloque {
  fila: number;
  columna: number;
  alto: number;
  ancho: number;
  primera: string;
  segunda: string;
  matriz: Matriz;
  modo: Modo;
  superior: Borde;
  izquierdo: Borde;
  traza: ArrayBufferLike;
}

export interface ResultadoBloque {
  fila: number;
  columna: number;
  inferior: Borde;
  derecho: Borde;
  mejor: { puntuacion: number; i: number; j: number; estado: number };
}

const ALFABETO = blosum.alfabeto;

/** Calcula una tesela independiente una vez conocidas sus fronteras superior e izquierda. */
export function calcularBloque(solicitud: SolicitudBloque): ResultadoBloque {
  const { fila, columna, alto, ancho, primera, segunda, matriz, modo, superior, izquierdo } = solicitud;
  const traza = new Uint8Array(solicitud.traza);
  const anchoTotal = segunda.length + 1;
  let previoM = Float32Array.from(superior.m);
  let previoX = Float32Array.from(superior.x);
  let previoY = Float32Array.from(superior.y);
  let actualM = new Float32Array(ancho + 1);
  let actualX = new Float32Array(ancho + 1);
  let actualY = new Float32Array(ancho + 1);
  const derecho: Borde = {
    m: new Float32Array(alto + 1),
    x: new Float32Array(alto + 1),
    y: new Float32Array(alto + 1),
  };
  derecho.m[0] = superior.m[ancho] ?? 0;
  derecho.x[0] = superior.x[ancho] ?? -Infinity;
  derecho.y[0] = superior.y[ancho] ?? -Infinity;
  let mejor = { puntuacion: 0, i: 0, j: 0, estado: 0 };
  const valores = blosum.valores[matriz];

  for (let localI = 1; localI <= alto; localI += 1) {
    const i = fila + localI;
    actualM[0] = izquierdo.m[localI] ?? 0;
    actualX[0] = izquierdo.x[localI] ?? -Infinity;
    actualY[0] = izquierdo.y[localI] ?? -Infinity;
    const valoresFila = valores[ALFABETO.indexOf(primera[i - 1] ?? '')] ?? [];
    for (let localJ = 1; localJ <= ancho; localJ += 1) {
      const j = columna + localJ;
      let diagonal = previoM[localJ - 1] ?? -Infinity;
      let origen = 0;
      if ((previoX[localJ - 1] ?? -Infinity) > diagonal) {
        diagonal = previoX[localJ - 1] ?? -Infinity;
        origen = 1;
      }
      if ((previoY[localJ - 1] ?? -Infinity) > diagonal) {
        diagonal = previoY[localJ - 1] ?? -Infinity;
        origen = 2;
      }
      let m = diagonal + (valoresFila[ALFABETO.indexOf(segunda[j - 1] ?? '')] ?? -Infinity);
      if (modo === 'local' && m <= 0) {
        m = 0;
        origen = 3;
      }
      const abreX = (previoM[localJ] ?? -Infinity) - 10;
      const extiendeX = (previoX[localJ] ?? -Infinity) - 0.5;
      const abreY = (actualM[localJ - 1] ?? -Infinity) - 10;
      const extiendeY = (actualY[localJ - 1] ?? -Infinity) - 0.5;
      actualM[localJ] = m;
      actualX[localJ] = Math.max(abreX, extiendeX);
      actualY[localJ] = Math.max(abreY, extiendeY);
      traza[i * anchoTotal + j] = origen | (extiendeX > abreX ? 4 : 0) | (extiendeY > abreY ? 8 : 0);
      if (modo === 'local' || i === primera.length || j === segunda.length) {
        const candidatos: [number, number][] = [[0, m], [1, actualX[localJ] ?? -Infinity], [2, actualY[localJ] ?? -Infinity]];
        for (const [estado, puntuacion] of candidatos) {
          if (puntuacion > mejor.puntuacion) mejor = { puntuacion, i, j, estado };
        }
      }
    }
    derecho.m[localI] = actualM[ancho] ?? 0;
    derecho.x[localI] = actualX[ancho] ?? -Infinity;
    derecho.y[localI] = actualY[ancho] ?? -Infinity;
    [previoM, actualM] = [actualM, previoM];
    [previoX, actualX] = [actualX, previoX];
    [previoY, actualY] = [actualY, previoY];
  }
  return { fila, columna, inferior: { m: previoM, x: previoX, y: previoY }, derecho, mejor };
}

/** Bordes de inicio para huecos terminales gratuitos en modo global y reinicio local. */
export function bordeInicial(longitud: number): Borde {
  return {
    m: new Float32Array(longitud + 1),
    x: new Float32Array(longitud + 1).fill(Number.NEGATIVE_INFINITY),
    y: new Float32Array(longitud + 1).fill(Number.NEGATIVE_INFINITY),
  };
}
