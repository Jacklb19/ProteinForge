import { HIDROPATIA } from './descriptors';

/** Ventanas aprobadas para el perfil Kyte–Doolittle sin puntos incompletos. */
export type VentanaHidropatia = 9 | 19;

/** Valor de hidropatía asignado al residuo central (posición de base uno). */
export interface PuntoPerfil {
  posicion: number;
  valor: number | null;
}

/** Calcula medias de ventanas completas con pesos uniformes, como ProtScale. */
export function calcularPerfil(secuencia: string, ventana: VentanaHidropatia): PuntoPerfil[] {
  if (secuencia.length === 0 || /[^ACDEFGHIKLMNPQRSTVWYUOBZX]/.test(secuencia)) {
    throw new RangeError('La secuencia contiene caracteres no admitidos.');
  }
  if (![9, 19].includes(ventana)) {
    throw new RangeError('La ventana debe ser 9 o 19.');
  }
  if (secuencia.length < ventana) return [];

  let suma = 0;
  let sinDato = 0;
  for (let indice = 0; indice < ventana; indice += 1) {
    const valor = HIDROPATIA[secuencia[indice] ?? ''];
    if (valor === undefined) sinDato += 1;
    else suma += valor;
  }
  const puntos: PuntoPerfil[] = [{ posicion: (ventana + 1) / 2, valor: sinDato > 0 ? null : suma / ventana }];
  for (let inicio = 1; inicio + ventana <= secuencia.length; inicio += 1) {
    const sale = HIDROPATIA[secuencia[inicio - 1] ?? ''];
    const entra = HIDROPATIA[secuencia[inicio + ventana - 1] ?? ''];
    if (sale === undefined) sinDato -= 1;
    else suma -= sale;
    if (entra === undefined) sinDato += 1;
    else suma += entra;
    puntos.push({ posicion: inicio + (ventana + 1) / 2, valor: sinDato > 0 ? null : suma / ventana });
  }
  return puntos;
}
