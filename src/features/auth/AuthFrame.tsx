import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { SequenceRibbon } from '../chemistry/SequenceRibbon';
import { annotationsFor } from '../editor/annotations';
import { DEFAULT_EXAMPLE } from '../editor/examples';
import { StructureStage } from '../structure/StructureStage';
import { useAuth } from './authContext';

interface Props {
  title: string;
  /** One line under the title; left out where the fields speak for themselves. */
  intro?: ReactNode;
  /** A note that replaces nothing in the form, such as where the visitor will return. */
  note?: ReactNode;
  children: ReactNode;
  /** Links shown under the form, such as the switch between sign in and sign up. */
  footer?: ReactNode;
}

/**
 * The measured insulin beside one form: the turning 1TRZ structure on wide screens and its chemistry strip
 * above the form on narrow ones. Both are the same example the tools open with.
 */
function AccessFigure(): React.JSX.Element | null {
  const { t, formatNumber } = useTranslation();
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);
  if (!annotations) return null;
  return <>
    <figure className="auth-figure">
      <StructureStage variant="access" annotations={annotations} />
      <p className="auth-figure-note"><strong>{t('auth.figureTitle')}</strong> {t('auth.figureText')}</p>
    </figure>
    <figure className="auth-strip">
      <SequenceRibbon sequence={DEFAULT_EXAMPLE.text} annotations={annotations} label={t('landing.strandLabel', { count: formatNumber(DEFAULT_EXAMPLE.text.length) })} />
      <figcaption>{t('auth.stripCaption', { count: formatNumber(DEFAULT_EXAMPLE.text.length) })}</figcaption>
    </figure>
  </>;
}

/** Access pages: the example protein and one form, which always fits the first screen. */
export function AuthFrame({ title, intro, note, children, footer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <main className="auth-layout" aria-labelledby="auth-title">
      <AccessFigure />
      <div className="auth-page">
        <header className="page-heading">
          <h1 id="auth-title">{title}</h1>
          {intro && <p>{intro}</p>}
        </header>
        {note}
        {status === 'disabled' && <p className="notice" role="note">{t('auth.disabled')}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  );
}
