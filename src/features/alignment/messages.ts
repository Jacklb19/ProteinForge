import type { SolicitudBloque, ResultadoBloque } from './tile';
import type { Matriz, Modo, ResultadoAlineamiento } from './gotoh';

/** Protocolo entre la interfaz y el Worker coordinador. */
export type SolicitudAlineamiento =
  | { tipo: 'iniciar'; id: number; primera: string; segunda: string; matriz: Matriz; modo: Modo }
  | { tipo: 'cancelar'; id: number };

export type RespuestaAlineamiento =
  | { tipo: 'progreso'; id: number; fraccion: number }
  | { tipo: 'resultado'; id: number; resultado: ResultadoAlineamiento }
  | { tipo: 'cancelado'; id: number }
  | { tipo: 'error'; id: number; mensaje: string };

/** Protocolo interno para las teselas paralelas. */
export interface SolicitudTesela { id: number; bloque: SolicitudBloque }
export type RespuestaTesela = { id: number; bloque: ResultadoBloque } | { id: number; error: string };
