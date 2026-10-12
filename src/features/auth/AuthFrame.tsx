import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { BrandMark } from '../../shared/BrandMark';
import { HeroChain } from '../landing/HeroChain';
import { useAuth } from './authContext';

interface Props {
  title: string;
  intro: string;
  children: ReactNode;
  /** Links shown under the form, such as the switch between sign in and sign up. */
  footer?: ReactNode;
}

/** Two panes: the chain keeps the identity on the left, the form stays focused on the right. */
export function AuthFrame({ title, intro, children, footer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <main className="auth-page">
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-art-brand"><BrandMark large /><span>{t('app.name')}</span></div>
        <HeroChain compact />
        <p className="auth-art-title">{t('auth.artTitle')}</p>
        <p className="auth-art-text">{t('auth.artText')}</p>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="page-heading">
          <h1 id="auth-title">{title}</h1>
          <p>{intro}</p>
        </header>
        {status === 'disabled' && <p className="notice" role="note">{t('auth.disabled')}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </section>
    </main>
  );
}
