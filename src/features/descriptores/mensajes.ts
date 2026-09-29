import type { Descriptores } from './descriptores';

/** Petición de cálculo enviada al Worker persistente. */
export interface SolicitudDescriptores {
  id: number;
  secuencia: string;
}

/** Respuesta identificada para descartar cálculos de una edición anterior. */
export type RespuestaDescriptores =
  | { id: number; resultado: Descriptores; error?: never }
  | { id: number; error: string; resultado?: never };
