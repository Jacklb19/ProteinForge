import { useEffect, useRef, useState } from 'react';
import { actualizarPosicionesInvalidas, separarResiduosEstandar, validarSecuencia } from './sequence';
import { CargadorFasta } from './FastaLoader';
import type { EntradaFasta } from './fasta';
import { PanelDescriptores } from '../descriptors/DescriptorPanel';
import { useDescriptores } from '../descriptors/useDescriptors';
import { PerfilHidrofobicidad } from '../descriptors/HydropathyProfile';

const RETRASO_VALIDACION_MS = 45;

/** Editor de secuencias con validación local incremental y aviso accesible. */
export function EditorPage(): React.JSX.Element {
  const [texto, setTexto] = useState('');
  const descriptores = useDescriptores(texto);
  const adicionales = separarResiduosEstandar(validarSecuencia(texto).secuencia).excluidos;
  const [posicionesInvalidas, setPosicionesInvalidas] = useState<number[]>([]);
  const textoValidado = useRef('');
  const posicionesValidadas = useRef<number[]>([]);
  const resaltado = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (texto === textoValidado.current) return;
    const temporizador = window.setTimeout(() => {
      const siguientes = actualizarPosicionesInvalidas(
        textoValidado.current,
        texto,
        posicionesValidadas.current,
      );
      textoValidado.current = texto;
      posicionesValidadas.current = siguientes;
      setPosicionesInvalidas(siguientes);
    }, RETRASO_VALIDACION_MS);
    return () => { window.clearTimeout(temporizador); };
  }, [texto]);

  const posiciones = new Set(posicionesInvalidas);
  const fragmentos: React.ReactNode[] = [];
  let inicio = 0;
  for (const posicion of posicionesInvalidas) {
    if (posicion > inicio) fragmentos.push(texto.slice(inicio, posicion));
    fragmentos.push(
      <mark key={posicion} className="residuo-invalido">
        {texto[posicion]}
      </mark>,
    );
    inicio = posicion + 1;
  }
  if (inicio < texto.length) fragmentos.push(texto.slice(inicio));

  const descripcion = posiciones.size === 0
    ? 'No hay posiciones inválidas.'
    : `Posiciones inválidas: ${posicionesInvalidas.map((posicion) => posicion + 1).join(', ')}.`;

  return (
    <main className="editor-page">
      <header>
        <h1>Editor de secuencias</h1>
        <p>Escribe o pega una secuencia de aminoácidos. Se aceptan los veinte residuos estándar y U, O, B, Z o X con aviso; se quita un * final.</p>
      </header>
      <section aria-labelledby="titulo-secuencia">
        <h2 id="titulo-secuencia">Secuencia activa</h2>
        <label htmlFor="secuencia">Secuencia de aminoácidos</label>
        <div className="editor-capa">
          <pre aria-hidden="true" className="editor-resaltado" ref={resaltado}>{fragmentos}{'\n'}</pre>
          <textarea
            id="secuencia"
            aria-describedby="ayuda-secuencia estado-secuencia"
            aria-invalid={posicionesInvalidas.length > 0}
            autoCapitalize="characters"
            spellCheck={false}
            value={texto}
            onChange={(evento) => { setTexto(evento.target.value.replace(/\*([\r\n]*)$/, '$1')); }}
            onScroll={(evento) => {
              if (resaltado.current) {
                resaltado.current.scrollTop = evento.currentTarget.scrollTop;
                resaltado.current.scrollLeft = evento.currentTarget.scrollLeft;
              }
            }}
          />
        </div>
        <p id="ayuda-secuencia">Las minúsculas se aceptan; los saltos de línea separan bloques de secuencia.</p>
        <p id="estado-secuencia" role="status" aria-live="polite">{descripcion}</p>
        {adicionales > 0 && <p role="note">La secuencia contiene {adicionales} residuo{adicionales === 1 ? '' : 's'} U, O, B, Z o X. Los descriptores los excluyen y las ventanas del perfil que los contienen muestran «sin dato».</p>}
      </section>
      <CargadorFasta alSeleccionar={(entrada: EntradaFasta) => {
        textoValidado.current = entrada.secuencia;
        posicionesValidadas.current = entrada.posicionesInvalidas;
        setTexto(entrada.secuencia);
        setPosicionesInvalidas(entrada.posicionesInvalidas);
      }} />
      <PanelDescriptores datos={descriptores} />
      <PerfilHidrofobicidad texto={texto} />
    </main>
  );
}
