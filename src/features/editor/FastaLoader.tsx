import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EntradaFasta } from './fasta';
import { resolverAlturaFila } from './rowHeight';

interface Props {
  alSeleccionar: (entrada: EntradaFasta) => void;
}

type MensajeFasta =
  | { tipo: 'entradas'; entradas: EntradaFasta[] }
  | { tipo: 'completo' }
  | { tipo: 'error'; mensaje: string };

/** Carga FASTA en un Worker y virtualiza la lista de entradas disponibles. */
export function CargadorFasta({ alSeleccionar }: Props): React.JSX.Element {
  const [entradas, setEntradas] = useState<EntradaFasta[]>([]);
  const [estado, setEstado] = useState('No hay archivo cargado.');
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [dimensiones, setDimensiones] = useState({ fila: 0, lista: 0 });
  const hilo = useRef<Worker | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const estilos = window.getComputedStyle(document.documentElement);
  const alturaToken = resolverAlturaFila(
    estilos.getPropertyValue('--height-fasta-row'),
    estilos.getPropertyValue('--height-fasta-row-default'),
  );
  const alturaFila = Number.isFinite(dimensiones.fila) && dimensiones.fila > 0
    ? dimensiones.fila : alturaToken.pixeles;
  const alturaLista = Number.isFinite(dimensiones.lista) && dimensiones.lista > 0
    ? dimensiones.lista : 0;

  useEffect(() => () => { hilo.current?.terminate(); }, []);
  useLayoutEffect(() => {
    const contenedor = lista.current;
    const fila = contenedor?.querySelector<HTMLElement>('.entrada-fasta');
    if (!contenedor || !fila) return;
    const filaMedida = fila.getBoundingClientRect().height;
    const listaMedida = contenedor.getBoundingClientRect().height;
    const medidas = {
      fila: Number.isFinite(filaMedida) && filaMedida > 0 ? filaMedida : alturaToken.pixeles,
      lista: Number.isFinite(listaMedida) && listaMedida > 0 ? listaMedida : 0,
    };
    setDimensiones((actuales) =>
      actuales.fila === medidas.fila && actuales.lista === medidas.lista ? actuales : medidas);
  }, [entradas.length, alturaToken.pixeles]);

  const elegir = (indice: number): void => {
    const entrada = entradas[indice];
    if (!entrada) return;
    setSeleccion(indice);
    alSeleccionar(entrada);
    if (lista.current) {
      const arriba = indice * alturaFila;
      const abajo = arriba + alturaFila;
      if (arriba < lista.current.scrollTop) lista.current.scrollTop = arriba;
      if (alturaLista > 0 && abajo > lista.current.scrollTop + alturaLista) {
        lista.current.scrollTop = abajo - alturaLista;
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

  const inicio = Math.min(
    Math.max(0, entradas.length - 1),
    Math.max(0, Math.floor((Number.isFinite(desplazamiento) ? desplazamiento : 0) / alturaFila) - 2),
  );
  const visibles = alturaLista > 0 ? Math.ceil(alturaLista / alturaFila) + 4 : 10;
  const cantidad = alturaToken.respaldoDeEmergencia ? Math.min(visibles, 10) : visibles;
  const fin = Math.min(entradas.length, inicio + cantidad);

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
          style={{ '--height-fasta-row-effective': `${String(alturaToken.pixeles)}px` } as React.CSSProperties}
          onScroll={(evento) => { setDesplazamiento(evento.currentTarget.scrollTop); }}
          onKeyDown={(evento) => {
            if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
              evento.preventDefault();
              const actual = seleccion ?? (evento.key === 'ArrowDown' ? -1 : entradas.length);
              elegir(Math.max(0, Math.min(entradas.length - 1, actual + (evento.key === 'ArrowDown' ? 1 : -1))));
            }
          }}
        >
          <div className="lista-fasta-contenido" style={{ height: `calc(var(--height-fasta-row-effective) * ${String(entradas.length)})` }}>
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
                  style={{ top: `calc(var(--height-fasta-row-effective) * ${String(indice)})` }}
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
