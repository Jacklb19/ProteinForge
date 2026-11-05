import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';
import { GLOSSARY } from './glossary';
import type { GlossaryTerm } from './glossary';

/** Only one definition is open at a time: opening one tells the others to close. */
const OPEN_EVENT = 'proteinforge:term-open';
/** Space kept between a definition and the edge of the screen. */
const EDGE_MARGIN_PX = 16;

/**
 * A term with a dotted underline that opens its definition just below it (a toggletip). Escape or a
 * click elsewhere closes it and the focus stays on the term. The definition is moved sideways when it
 * would leave the screen, so nothing ever sticks out on a phone.
 */
export function Term({ term, children }: { term: GlossaryTerm; children: ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const host = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const others = (event: Event): void => { if ((event as CustomEvent<string>).detail !== id) setOpen(false); };
    window.addEventListener(OPEN_EVENT, others);
    return () => { window.removeEventListener(OPEN_EVENT, others); };
  }, [id]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent): void => { if (host.current && !host.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    element.style.removeProperty('inset-inline-start');
    const box = element.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const shift = box.right > width - EDGE_MARGIN_PX ? width - EDGE_MARGIN_PX - box.right : box.left < EDGE_MARGIN_PX ? EDGE_MARGIN_PX - box.left : 0;
    if (shift) element.style.setProperty('inset-inline-start', `${String(shift)}px`);
  }, [open]);

  return (
    <span className="term-host" ref={host}>
      <button
        ref={button} type="button" className="term" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => { setOpen((value) => { if (!value) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id })); return !value; }); }}
      >{children}</button>
      {open && <span ref={panel} id={id} role="note" className="term-panel"><strong>{t(GLOSSARY[term].name)}.</strong> {t(GLOSSARY[term].definition)}</span>}
    </span>
  );
}

/**
 * Renders a sentence with its glossary terms as {@link Term}s. Each term is found by its phrase in the
 * current language, so the sentence itself stays a single translated string.
 */
export function Glossed({ text, terms }: { text: string; terms: readonly GlossaryTerm[] }): React.JSX.Element {
  const { t } = useTranslation();
  const phrases = terms.map((term) => ({ term, phrase: t(GLOSSARY[term].phrase) }));
  const nodes: ReactNode[] = [];
  let rest = text;
  for (;;) {
    const next = phrases
      .map((entry) => ({ ...entry, at: rest.indexOf(entry.phrase) }))
      .filter((entry) => entry.at >= 0)
      .sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    if (next.at > 0) nodes.push(rest.slice(0, next.at));
    nodes.push(<Term key={nodes.length} term={next.term}>{next.phrase}</Term>);
    rest = rest.slice(next.at + next.phrase.length);
  }
  if (rest) nodes.push(rest);
  return <>{nodes}</>;
}
