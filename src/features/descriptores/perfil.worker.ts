/// <reference lib="webworker" />

import { dibujarPerfil } from './dibujarPerfil';
import type { RespuestaPerfil, SolicitudPerfil } from './mensajesPerfil';
import { calcularPerfil } from './perfil';
import { calcularPropensiones } from './chouFasman';

const contexto = self as DedicatedWorkerGlobalScope;
let lienzo: OffscreenCanvas | null = null;
let estiloGrafica: SolicitudPerfil['estilo'] | null = null;

contexto.onmessage = (evento: MessageEvent<SolicitudPerfil>) => {
  const solicitud = evento.data;
  if (solicitud.tipo === 'iniciar') {
    lienzo = solicitud.lienzo;
    estiloGrafica = solicitud.estilo;
    return;
  }
  try {
    estiloGrafica = solicitud.estilo;
    const puntos = calcularPerfil(solicitud.secuencia, solicitud.ventana);
    const propensiones = calcularPropensiones(solicitud.secuencia);
    if (lienzo) {
      dibujarPerfil(
        lienzo,
        puntos,
        solicitud.ventana,
        solicitud.ancho,
        solicitud.alto,
        solicitud.escala,
        estiloGrafica,
      );
    }
    const respuesta: RespuestaPerfil = { id: solicitud.id, puntos, propensiones };
    contexto.postMessage(respuesta);
  } catch (error) {
    const respuesta: RespuestaPerfil = {
      id: solicitud.id,
      error: error instanceof Error ? error.message : 'No se pudo generar el perfil.',
    };
    contexto.postMessage(respuesta);
  }
};
