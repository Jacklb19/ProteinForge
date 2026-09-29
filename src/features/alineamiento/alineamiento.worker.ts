/// <reference lib="webworker" />

import { alinearPorBloques, LADO_BLOQUE } from './frenteOnda';
import type { SolicitudBloque, ResultadoBloque } from './bloque';
import type { SolicitudAlineamiento, RespuestaAlineamiento, RespuestaTesela, SolicitudTesela } from './mensajes';

const contexto = self as DedicatedWorkerGlobalScope;
let activo: { id: number; cancelado: boolean } | null = null;

function ejecutarTesela(worker: Worker, bloque: SolicitudBloque, id: number): Promise<ResultadoBloque> {
  return new Promise((resolver, rechazar) => {
    worker.onmessage = (evento: MessageEvent<RespuestaTesela>) => {
      if (evento.data.id !== id) return;
      if ('error' in evento.data) rechazar(new Error(evento.data.error));
      else resolver(evento.data.bloque);
    };
    worker.onerror = () => { rechazar(new Error('Un hilo de cálculo dejó de responder.')); };
    const solicitud: SolicitudTesela = { id, bloque };
    worker.postMessage(solicitud);
  });
}

async function ejecutarEnConjunto(workers: Worker[], solicitudes: SolicitudBloque[], id: number): Promise<ResultadoBloque[]> {
  const respuestas: ResultadoBloque[] = [];
  for (let inicio = 0; inicio < solicitudes.length; inicio += workers.length) {
    const lote = solicitudes.slice(inicio, inicio + workers.length);
    const calculados = await Promise.all(lote.map((bloque, indice) => {
      const worker = workers[indice];
      if (!worker) throw new Error('Falta un hilo para una tesela.');
      return ejecutarTesela(worker, bloque, id);
    }));
    respuestas.push(...calculados);
  }
  return respuestas;
}

contexto.onmessage = (evento: MessageEvent<SolicitudAlineamiento>) => {
  const solicitud = evento.data;
  if (solicitud.tipo === 'cancelar') {
    if (activo?.id === solicitud.id) activo.cancelado = true;
    return;
  }
  if (activo) {
    const respuesta: RespuestaAlineamiento = { tipo: 'error', id: solicitud.id, mensaje: 'Ya hay un alineamiento en curso.' };
    contexto.postMessage(respuesta);
    return;
  }
  const tarea = { id: solicitud.id, cancelado: false };
  activo = tarea;
  const puedeCompartir = typeof SharedArrayBuffer !== 'undefined' && contexto.crossOriginIsolated;
  const nucleos = Math.max(1, (contexto.navigator.hardwareConcurrency || 2) - 1);
  const paralelismo = Math.min(nucleos, Math.ceil(Math.min(solicitud.primera.length, solicitud.segunda.length) / LADO_BLOQUE));
  const workers = puedeCompartir && paralelismo > 1
    ? Array.from({ length: paralelismo }, () => new Worker(new URL('./tesela.worker.ts', import.meta.url), { type: 'module' }))
    : [];
  const ejecutarLote = workers.length > 0
    ? (bloques: SolicitudBloque[]) => ejecutarEnConjunto(workers, bloques, solicitud.id)
    : undefined;
  void alinearPorBloques(solicitud.primera, solicitud.segunda, {
    matriz: solicitud.matriz,
    modo: solicitud.modo,
    memoriaCompartida: workers.length > 0,
    ejecutarLote,
    cancelado: () => tarea.cancelado,
    progreso: (fraccion) => {
      const respuesta: RespuestaAlineamiento = { tipo: 'progreso', id: tarea.id, fraccion };
      contexto.postMessage(respuesta);
    },
  }).then((resultado) => {
    const respuesta: RespuestaAlineamiento = tarea.cancelado
      ? { tipo: 'cancelado', id: tarea.id }
      : { tipo: 'resultado', id: tarea.id, resultado };
    contexto.postMessage(respuesta);
  }).catch((error: unknown) => {
    const respuesta: RespuestaAlineamiento = tarea.cancelado
      ? { tipo: 'cancelado', id: tarea.id }
      : { tipo: 'error', id: tarea.id, mensaje: error instanceof Error ? error.message : 'No se pudo alinear.' };
    contexto.postMessage(respuesta);
  }).finally(() => {
    workers.forEach((worker) => { worker.terminate(); });
    if (activo === tarea) activo = null;
  });
};
