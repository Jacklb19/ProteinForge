import { useEffect, useMemo, useRef, useState } from 'react';
import { splitStandardResidues, validateSequence } from '../editor/sequence';
import type { Descriptores } from './descriptors';
import type { RespuestaDescriptores, SolicitudDescriptores } from './messages';

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
  const validacion = useMemo(() => validateSequence(texto), [texto]);
  const residuos = useMemo(() => splitStandardResidues(validacion.sequence), [validacion.sequence]);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoRecibido | null>(null);
  const [errorActual, setErrorActual] = useState<ErrorRecibido | null>(null);
  const [errorHilo, setErrorHilo] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const ultimaPeticion = useRef(0);
  const secuenciaEnviada = useRef('');

  useEffect(() => {
    try {
      const instancia = new Worker(new URL('./descriptors.worker.ts', import.meta.url), { type: 'module' });
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
    if (validacion.invalidPositions.length > 0 || residuos.standard.length === 0) return;
    secuenciaEnviada.current = validacion.sequence;
    const solicitud: SolicitudDescriptores = { id, secuencia: residuos.standard };
    worker.current?.postMessage(solicitud);
  }, [validacion, residuos]);

  const resultado = ultimoResultado?.datos ?? null;
  if (validacion.invalidPositions.length > 0) return { resultado, estado: 'invalido', error: null, excluidos: residuos.excluded };
  if (residuos.standard.length === 0) return { resultado: null, estado: 'vacio', error: null, excluidos: residuos.excluded };
  if (errorHilo) return { resultado, estado: 'error', error: errorHilo, excluidos: residuos.excluded };
  if (errorActual?.secuencia === validacion.sequence) {
    return { resultado, estado: 'error', error: errorActual.mensaje, excluidos: residuos.excluded };
  }
  if (ultimoResultado?.secuencia === validacion.sequence) {
    return { resultado, estado: 'actual', error: null, excluidos: residuos.excluded };
  }
  return { resultado, estado: 'calculando', error: null, excluidos: residuos.excluded };
}
