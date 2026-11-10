import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { TOUR_STOPS } from './tour';

/**
 * The guided visit, docked under the tool it describes: it never covers the page, and each stop is the
 * real tool with its example, so everything said can be tried at once.
 */
export function TourPanel({ stop, onStop, onEnd }: { stop: number; onStop: (stop: number) => void; onEnd: () => void }): React.JSX.Element | null {
  const { t, formatNumber } = useTranslation();
  const navigate = useNavigate();
  const title = useRef<HTMLHeadingElement>(null);
  const current = TOUR_STOPS[stop];
  // Each stop opens its tool and takes the focus, so the change is announced and the keyboard stays here.
  useEffect(() => {
    if (!current) return;
    void navigate(current.path);
    title.current?.focus();
  }, [current, navigate]);
  if (!current) return null;
  const last = stop === TOUR_STOPS.length - 1;
  return (
    <aside className="tour-panel" aria-labelledby="tour-title">
      <div className="tour-text">
        <p className="field-meta">{t('tour.progress', { current: formatNumber(stop + 1), total: formatNumber(TOUR_STOPS.length) })}</p>
        <h2 id="tour-title" ref={title} tabIndex={-1}>{t(current.titleKey)}</h2>
        <p>{t(current.bodyKey)}</p>
      </div>
      <div className="actions">
        <button type="button" className="button button-quiet" onClick={onEnd}>{t('tour.end')}</button>
        {stop > 0 && <button type="button" className="button button-secondary" onClick={() => { onStop(stop - 1); }}>{t('tour.previous')}</button>}
        <button type="button" className="button button-primary" onClick={() => { if (last) onEnd(); else onStop(stop + 1); }}>{t(last ? 'tour.finish' : 'tour.next')}</button>
      </div>
    </aside>
  );
}
