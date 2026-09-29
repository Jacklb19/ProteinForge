import type { EstiloGrafica } from './mensajesPerfil';
import type { PuntoPerfil, VentanaHidropatia } from './perfil';

/** Líneas de referencia científicas que acompañan la curva. */
export function referenciasParaVentana(ventana: VentanaHidropatia): number[] {
  return ventana === 19 ? [0, 1.6] : [0];
}

/** Dibuja el perfil y las referencias en el lienzo transferido al Worker. */
export function dibujarPerfil(
  lienzo: OffscreenCanvas,
  puntos: readonly PuntoPerfil[],
  ventana: VentanaHidropatia,
  ancho: number,
  alto: number,
  escala: number,
  estilo: EstiloGrafica,
): void {
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('No se pudo iniciar el contexto 2D de la gráfica.');
  lienzo.width = Math.max(1, Math.round(ancho * escala));
  lienzo.height = Math.max(1, Math.round(alto * escala));
  contexto.setTransform(escala, 0, 0, escala, 0, 0);
  contexto.fillStyle = estilo.superficie;
  contexto.fillRect(0, 0, ancho, alto);
  if (puntos.length === 0) return;

  const referencias = referenciasParaVentana(ventana);
  let minimo = Math.min(...referencias, -0.5);
  let maximo = Math.max(...referencias, 0.5);
  for (const punto of puntos) {
    if (punto.valor !== null) {
      minimo = Math.min(minimo, punto.valor);
      maximo = Math.max(maximo, punto.valor);
    }
  }
  const espacioX = Math.max(1, ancho - 2 * estilo.margen);
  const espacioY = Math.max(1, alto - 2 * estilo.margen);
  const primera = puntos[0]?.posicion ?? 0;
  const ultima = puntos.at(-1)?.posicion ?? primera;
  const xDe = (posicion: number): number => ultima === primera
    ? ancho / 2
    : estilo.margen + ((posicion - primera) / (ultima - primera)) * espacioX;
  const yDe = (valor: number): number => alto - estilo.margen
    - ((valor - minimo) / (maximo - minimo)) * espacioY;

  contexto.font = estilo.fuente;
  contexto.fillStyle = estilo.texto;
  contexto.strokeStyle = estilo.referencia;
  contexto.lineWidth = estilo.trazoReferencia;
  for (const referencia of referencias) {
    const y = yDe(referencia);
    contexto.beginPath();
    contexto.moveTo(estilo.margen, y);
    contexto.lineTo(ancho - estilo.margen, y);
    contexto.stroke();
    contexto.fillText(referencia === 0 ? '0' : '1,6', estilo.margen, y - estilo.trazoReferencia);
  }

  contexto.strokeStyle = estilo.curva;
  contexto.lineWidth = estilo.trazo;
  contexto.beginPath();
  let trazoAbierto = false;
  for (const punto of puntos) {
    if (punto.valor === null) {
      trazoAbierto = false;
      continue;
    }
    if (!trazoAbierto) contexto.moveTo(xDe(punto.posicion), yDe(punto.valor));
    else contexto.lineTo(xDe(punto.posicion), yDe(punto.valor));
    trazoAbierto = true;
  }
  contexto.stroke();
  if (puntos.length === 1 && puntos[0]?.valor !== null) {
    contexto.beginPath();
    contexto.arc(xDe(primera), yDe(puntos[0]?.valor ?? 0), estilo.trazo * 2, 0, Math.PI * 2);
    contexto.fillStyle = estilo.curva;
    contexto.fill();
  }
  contexto.fillStyle = estilo.texto;
  contexto.fillText(String(primera), estilo.margen, alto - estilo.trazoReferencia);
  contexto.fillText(String(ultima), ancho - estilo.margen, alto - estilo.trazoReferencia);
}
