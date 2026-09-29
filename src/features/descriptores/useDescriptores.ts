import { useEffect, useMemo, useRef, useState } from 'react';
import { separarResiduosEstandar, validarSecuencia } from '../editor/secuencia';
import type { Descriptores } from './descriptores';
import type { RespuestaDescriptores, SolicitudDescriptores } from './mensajes';

/** Estado visible del último cálculo y de la entrada que lo originó. */
export interface EstadoDescriptores {
  resultado: Descriptores | null;
  estado: 'vacio' | 'calculando' | 'actual' | 'invalido' | 'error';
  error: string | null;
  excluidos: number;
}

interface ResultadoRecibido { secuencia: string; datos: Descriptores }
interface ErrorRecibido { secuencia: string; mensaje: string }

/** Mantiene un Worker y descarta resultados de versiones anteriores del editor. */
export function useDescriptores(texto: string): EstadoDescriptores {
  const validacion = useMemo(() => validarSecuencia(texto), [texto]);
  const residuos = useMemo(() => separarResiduosEstandar(validacion.secuencia), [validacion.secuencia]);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoRecibido | null>(null);
  const [errorActual, setErrorActual] = useState<ErrorRecibido | null>(null);
  const [errorHilo, setErrorHilo] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const ultimaPeticion = useRef(0);
  const secuenciaEnviada = useRef('');

  useEffect(() => {
    try {
      const instancia = new Worker(new URL('./descriptores.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instancia;
      instancia.onmessage = (evento: MessageEvent<RespuestaDescriptores>) => {
        const respuesta = evento.data;
        if (respuesta.id !== ultimaPeticion.current) return;
        if (respuesta.error) {
          setErrorActual({ secuencia: secuenciaEnviada.current, mensaje: respuesta.error });
          return;
        }
        if (respuesta.resultado) {
          setUltimoResultado({ secuencia: secuenciaEnviada.current, datos: respuesta.resultado });
        }
      };
      instancia.onerror = () => { setErrorHilo('El hilo de cálculo dejó de responder.'); };
    } catch {
      queueMicrotask(() => { setErrorHilo('Este navegador no pudo iniciar el hilo de cálculo.'); });
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);

  useEffect(() => {
    const id = ++ultimaPeticion.current;
    if (validacion.posicionesInvalidas.length > 0 || residuos.estandar.length === 0) return;
    secuenciaEnviada.current = validacion.secuencia;
    const solicitud: SolicitudDescriptores = { id, secuencia: residuos.estandar };
    worker.current?.postMessage(solicitud);
  }, [validacion, residuos]);

  const resultado = ultimoResultado?.datos ?? null;
  if (validacion.posicionesInvalidas.length > 0) return { resultado, estado: 'invalido', error: null, excluidos: residuos.excluidos };
  if (residuos.estandar.length === 0) return { resultado: null, estado: 'vacio', error: null, excluidos: residuos.excluidos };
  if (errorHilo) return { resultado, estado: 'error', error: errorHilo, excluidos: residuos.excluidos };
  if (errorActual?.secuencia === validacion.secuencia) {
    return { resultado, estado: 'error', error: errorActual.mensaje, excluidos: residuos.excluidos };
  }
  if (ultimoResultado?.secuencia === validacion.secuencia) {
    return { resultado, estado: 'actual', error: null, excluidos: residuos.excluidos };
  }
  return { resultado, estado: 'calculando', error: null, excluidos: residuos.excluidos };
}
