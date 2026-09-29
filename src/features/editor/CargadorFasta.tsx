import { useEffect, useRef, useState } from 'react';
import type { EntradaFasta } from './fasta';

interface Props {
  alSeleccionar: (entrada: EntradaFasta) => void;
}

type MensajeFasta =
  | { tipo: 'entradas'; entradas: EntradaFasta[] }
  | { tipo: 'completo' }
  | { tipo: 'error'; mensaje: string };

const ALTURA_FILA = 44;
const ALTURA_LISTA = 264;

/** Carga FASTA en un Worker y virtualiza la lista de entradas disponibles. */
export function CargadorFasta({ alSeleccionar }: Props): React.JSX.Element {
  const [entradas, setEntradas] = useState<EntradaFasta[]>([]);
  const [estado, setEstado] = useState('No hay archivo cargado.');
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const hilo = useRef<Worker | null>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => () => { hilo.current?.terminate(); }, []);

  const elegir = (indice: number): void => {
    const entrada = entradas[indice];
    if (!entrada) return;
    setSeleccion(indice);
    alSeleccionar(entrada);
    if (lista.current) {
      const arriba = indice * ALTURA_FILA;
      const abajo = arriba + ALTURA_FILA;
      if (arriba < lista.current.scrollTop) lista.current.scrollTop = arriba;
      if (abajo > lista.current.scrollTop + ALTURA_LISTA) {
        lista.current.scrollTop = abajo - ALTURA_LISTA;
      }
    }
  };

  const cargarArchivo = (archivo: File | undefined): void => {
    if (!archivo) return;
    hilo.current?.terminate();
    setEntradas([]);
    setSeleccion(null);
    setDesplazamiento(0);
    if (lista.current) lista.current.scrollTop = 0;
    setEstado('Leyendo archivo FASTA…');

    try {
      const nuevoHilo = new Worker(new URL('./fasta.worker.ts', import.meta.url), { type: 'module' });
      hilo.current = nuevoHilo;
      nuevoHilo.onmessage = (evento: MessageEvent<MensajeFasta>) => {
        if (hilo.current !== nuevoHilo) return;
        const mensaje = evento.data;
        if (mensaje.tipo === 'entradas') {
          setEntradas((actuales) => [...actuales, ...mensaje.entradas]);
        } else if (mensaje.tipo === 'completo') {
          setEstado('Archivo FASTA cargado. Elige una entrada para editarla.');
          nuevoHilo.terminate();
          if (hilo.current === nuevoHilo) hilo.current = null;
        } else {
          setEntradas([]);
          setEstado(`Error: ${mensaje.mensaje}`);
          nuevoHilo.terminate();
          if (hilo.current === nuevoHilo) hilo.current = null;
        }
      };
      nuevoHilo.onerror = () => {
        if (hilo.current !== nuevoHilo) return;
        setEntradas([]);
        setEstado('Error: no se pudo ejecutar el analizador FASTA.');
        nuevoHilo.terminate();
        if (hilo.current === nuevoHilo) hilo.current = null;
      };
      nuevoHilo.postMessage(archivo);
    } catch {
      hilo.current = null;
      setEstado('Error: el navegador no pudo iniciar el analizador FASTA.');
    }
  };

  const inicio = Math.max(0, Math.floor(desplazamiento / ALTURA_FILA) - 2);
  const fin = Math.min(entradas.length, inicio + Math.ceil(ALTURA_LISTA / ALTURA_FILA) + 4);

  return (
    <section aria-labelledby="titulo-fasta">
      <h2 id="titulo-fasta">Cargar FASTA</h2>
      <label htmlFor="archivo-fasta">Archivo FASTA de hasta 5 MB</label>
      <input
        id="archivo-fasta"
        type="file"
        accept=".fa,.faa,.fasta,.fsa,text/plain"
        onChange={(evento) => {
          cargarArchivo(evento.currentTarget.files?.[0]);
          evento.currentTarget.value = '';
        }}
      />
      <p role="status" aria-live="polite">{estado} {entradas.length > 0 ? `${String(entradas.length)} entradas encontradas.` : ''}</p>
      {entradas.length > 0 && (
        <div
          ref={lista}
          className="lista-fasta"
          role="listbox"
          aria-label="Entradas FASTA"
          aria-activedescendant={seleccion !== null && seleccion >= inicio && seleccion < fin
            ? `entrada-fasta-${String(seleccion)}` : undefined}
          tabIndex={0}
          onScroll={(evento) => { setDesplazamiento(evento.currentTarget.scrollTop); }}
          onKeyDown={(evento) => {
            if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
              evento.preventDefault();
              const actual = seleccion ?? (evento.key === 'ArrowDown' ? -1 : entradas.length);
              elegir(Math.max(0, Math.min(entradas.length - 1, actual + (evento.key === 'ArrowDown' ? 1 : -1))));
            }
          }}
        >
          <div className="lista-fasta-contenido" style={{ height: entradas.length * ALTURA_FILA }}>
            {entradas.slice(inicio, fin).map((entrada, desplazamientoLocal) => {
              const indice = inicio + desplazamientoLocal;
              return (
                <button
                  className="entrada-fasta"
                  id={`entrada-fasta-${String(indice)}`}
                  key={entrada.numero}
                  type="button"
                  role="option"
                  aria-selected={seleccion === indice}
                  aria-setsize={entradas.length}
                  aria-posinset={indice + 1}
                  tabIndex={-1}
                  style={{ top: indice * ALTURA_FILA }}
                  onClick={() => { elegir(indice); }}
                >
                  <span>{entrada.encabezado}</span>
                  <span>{String(entrada.secuencia.length)} residuos</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
