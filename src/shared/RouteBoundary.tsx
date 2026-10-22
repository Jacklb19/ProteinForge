import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from '../i18n';

/** What a visitor sees when a screen cannot be shown: no blank page, no invented content. */
function ScreenFailure(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="page">
      <h1>{t('shell.screenFailed')}</h1>
      <p>{t('shell.screenFailedHelp')}</p>
      <div className="actions">
        <button type="button" className="button button-primary" onClick={() => { window.location.reload(); }}>{t('shell.reload')}</button>
      </div>
    </main>
  );
}

/**
 * Screens arrive as their own file, and a network failure or a replaced build leaves one unreachable.
 * Without this, React unmounts the whole page and the visitor is left with an empty document. Mounted
 * under a key of the current address, so moving to another screen clears a past failure.
 */
export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The browser console keeps the detail for whoever is debugging; the page states only what happened.
    console.error('A screen could not be shown', error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? <ScreenFailure /> : this.props.children;
  }
}
