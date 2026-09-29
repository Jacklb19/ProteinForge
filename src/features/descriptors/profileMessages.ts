import type { PuntoPerfil, VentanaHidropatia } from './profile';
import type { PropensionResiduo } from './chouFasman';

/** Valores visuales calculados en el hilo principal desde design-tokens.css. */
export interface EstiloGrafica {
  superficie: string;
  texto: string;
  curva: string;
  referencia: string;
  fuente: string;
  margen: number;
  trazo: number;
  trazoReferencia: number;
}

/** Configuración y cálculo enviados al Worker de perfil y dibujo. */
export type SolicitudPerfil =
  | { tipo: 'iniciar'; lienzo: OffscreenCanvas; estilo: EstiloGrafica }
  | {
    tipo: 'calcular';
    id: number;
    secuencia: string;
    ventana: VentanaHidropatia;
    ancho: number;
    alto: number;
    escala: number;
    estilo: EstiloGrafica;
  };

/** El perfil completo vuelve al hilo principal para la tabla accesible. */
export type RespuestaPerfil =
  | { id: number; puntos: PuntoPerfil[]; propensiones: PropensionResiduo[]; error?: never }
  | { id: number; error: string; puntos?: never; propensiones?: never };
