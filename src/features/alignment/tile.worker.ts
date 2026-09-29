/// <reference lib="webworker" />

import { calcularBloque } from './tile';
import type { SolicitudTesela, RespuestaTesela } from './messages';

const contexto = self as DedicatedWorkerGlobalScope;

contexto.onmessage = (evento: MessageEvent<SolicitudTesela>) => {
  try {
    const bloque = calcularBloque(evento.data.bloque);
    const respuesta: RespuestaTesela = { id: evento.data.id, bloque };
    contexto.postMessage(respuesta, [
      bloque.inferior.m.buffer, bloque.inferior.x.buffer, bloque.inferior.y.buffer,
      bloque.derecho.m.buffer, bloque.derecho.x.buffer, bloque.derecho.y.buffer,
    ]);
  } catch (error) {
    const respuesta: RespuestaTesela = {
      id: evento.data.id,
      error: error instanceof Error ? error.message : 'Falló una tesela del alineamiento.',
    };
    contexto.postMessage(respuesta);
  }
};
