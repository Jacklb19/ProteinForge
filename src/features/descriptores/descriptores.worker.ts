/// <reference lib="webworker" />

import { calcularDescriptores } from './descriptores';
import type { RespuestaDescriptores, SolicitudDescriptores } from './mensajes';

const contexto = self as DedicatedWorkerGlobalScope;

contexto.onmessage = (evento: MessageEvent<SolicitudDescriptores>) => {
  const { id, secuencia } = evento.data;
  try {
    const respuesta: RespuestaDescriptores = { id, resultado: calcularDescriptores(secuencia) };
    contexto.postMessage(respuesta);
  } catch (error) {
    const respuesta: RespuestaDescriptores = {
      id,
      error: error instanceof Error ? error.message : 'No se pudieron calcular los descriptores.',
    };
    contexto.postMessage(respuesta);
  }
};
