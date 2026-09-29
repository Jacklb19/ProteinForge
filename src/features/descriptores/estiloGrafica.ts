import type { EstiloGrafica } from './mensajesPerfil';

function medidaPositiva(valor: string): number {
  const numero = Number.parseFloat(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : 1;
}

/** Resuelve los tokens CSS en el hilo principal antes de transferirlos al Worker. */
export function obtenerEstiloGrafica(lienzo: HTMLCanvasElement): EstiloGrafica {
  const raiz = getComputedStyle(document.documentElement);
  const grafica = getComputedStyle(lienzo);
  const token = (nombre: string): string => raiz.getPropertyValue(nombre).trim();
  return {
    superficie: token('--color-surface') || raiz.backgroundColor,
    texto: token('--color-text') || raiz.color,
    curva: token('--color-focus') || raiz.color,
    referencia: token('--color-border') || raiz.color,
    fuente: `${grafica.fontWeight} ${grafica.fontSize} ${grafica.fontFamily}`,
    margen: medidaPositiva(token('--space-chart-inner')),
    trazo: medidaPositiva(token('--border-width-chart-line')),
    trazoReferencia: medidaPositiva(token('--border-width-chart-reference')),
  };
}
