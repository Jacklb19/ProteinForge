import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { readApiBaseUrl } from '../api/config';
import { useAuth } from '../auth/authContext';
import { ASSISTANT_ERROR_KEYS } from './config';
import type { ReadingSubject } from './config';
import type { AssistantApi, Fact } from './assistantApi';
import { useReading } from './useReading';

interface Props {
  subject: ReadingSubject;
  /** Called when a reading is asked for, so the figures sent are the ones then on screen. */
  build: () => Fact[];
  /** Changes whenever the figures change; a reading of the previous ones is dropped. */
  revision: string;
  /** Tests pass a client; `undefined` loads the generated contracts on first use. */
  api?: AssistantApi | null;
}

/**
 * Reads the figures of the screen, in the reader's language, only when asked: until then it is a single
 * secondary action, «Ask for a reading», next to the figures it would read. It sends those figures and
 * nothing else: the sequence stays in the browser, which is why the notice can be one line.
 */
export function ReadingSection({ subject, build, revision, api }: Props): React.JSX.Element | null {
  const auth = useAuth();
  const owner = auth.status === 'signed-in' ? auth.session?.user.id : null;
  return <SessionReading key={owner ?? 'anonymous'} subject={subject} build={build} revision={revision} api={api} />;
}

/** Readings and pending imports belong to one owner; token refresh keeps that owner's view. */
function SessionReading({ subject, build, revision, api }: Props): React.JSX.Element | null {
  const { t, formatDate, formatNumber } = useTranslation();
  const auth = useAuth();
  const [configuredUrl] = useState(readApiBaseUrl);
  const [loaded, setLoaded] = useState<AssistantApi | null>(null);
  useEffect(() => {
    if (api !== undefined || !configuredUrl || auth.status !== 'signed-in') return;
    let cancelled = false;
    void import('./assistantApi')
      .then(({ createAssistantApi }) => { if (!cancelled) setLoaded(createAssistantApi(configuredUrl)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api, configuredUrl, auth.status]);

  const client = api === undefined ? loaded : api;
  const token = auth.session?.accessToken ?? null;
  const { reading, facts, busy, error, read } = useReading(client, subject, token, build, revision);
  const [asked, setAsked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (asked) heading.current?.focus(); }, [asked]);
  if (auth.status === 'disabled' || !configuredUrl) return null;

  const signedIn = auth.status === 'signed-in';
  // Every tool needs an account, so without a session there is nothing to ask for.
  if (!asked) return signedIn ? (
    <p className="reading-ask">
      <button type="button" className="button button-quiet" disabled={!client} onClick={() => { setAsked(true); read(); }}>{t('assistant.ask')}</button>
    </p>
  ) : null;
  return (
    <section className="reading" aria-labelledby={`reading-${subject}`}>
      <div className="section-header">
        <h2 id={`reading-${subject}`} ref={heading} tabIndex={-1}>{t('assistant.title')}</h2>
        {signedIn && (reading
          ? <button type="button" className="button button-quiet" disabled={busy} onClick={read}>{t('assistant.again')}</button>
          : <button type="button" className="button button-secondary" disabled={busy || !client} onClick={read}>{t(`assistant.read.${subject}`)}</button>)}
      </div>

      <div className="reading-body">
        <div className="reading-column">
          {!signedIn ? (
            <p className="field-help">
              {t('assistant.signInHelp')}{' '}
              <Link className="button button-quiet" state={{ from: subject === 'analysis' ? ROUTES.analyze : ROUTES.laboratory }} to={ROUTES.signIn}>{t('shell.signIn')}</Link>
            </p>
          ) : <>
            <p className="status-message" data-state={error ? 'error' : undefined} role="status">
              {busy ? t('assistant.busy') : error ? t(ASSISTANT_ERROR_KEYS[error.code]) : ''}
            </p>
            {reading && <>
              <div className="reading-text">
                {reading.text.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={paragraph.slice(0, 24) + String(index)} className={index === 0 ? 'reading-lead' : undefined}>{paragraph.trim()}</p>
                ))}
              </div>
              <p className="field-help">{t('assistant.provenance', { model: reading.model, provider: reading.provider, time: formatDate(new Date(reading.createdAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
              {typeof reading.remaining === 'number' && <p className="field-help">{reading.remaining === 0 ? t('assistant.remainingNone') : t(reading.remaining === 1 ? 'assistant.remainingOne' : 'assistant.remainingMany', { count: formatNumber(reading.remaining) })}</p>}
            </>}
            {!reading && !busy && !error && <p className="field-help">{t('assistant.scope')}</p>}
          </>}
        </div>

        {/* The figures that were sent, so the reading can be checked against them. */}
        {facts && reading && (
          <section className="reading-sources" aria-labelledby={`reading-sources-${subject}`}>
            <h3 id={`reading-sources-${subject}`}>{t('assistant.sources')}</h3>
            <dl>
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd className="numeric">{fact.unit ? `${fact.value} ${fact.unit}` : fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </section>
  );
}
