import { useEffect, useState } from 'react';
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
 * Reads the figures of the screen it closes, in the reader's language. It sends those figures and
 * nothing else: the sequence stays in the browser, which is why the notice can be one line.
 */
export function ReadingSection({ subject, build, revision, api }: Props): React.JSX.Element | null {
  const { t, formatDate } = useTranslation();
  const auth = useAuth();
  const [configuredUrl] = useState(readApiBaseUrl);
  const [loaded, setLoaded] = useState<AssistantApi | null>(null);
  useEffect(() => {
    if (api !== undefined || !configuredUrl) return;
    let cancelled = false;
    void import('./assistantApi')
      .then(({ createAssistantApi }) => { if (!cancelled) setLoaded(createAssistantApi(configuredUrl)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api, configuredUrl]);

  const client = api === undefined ? loaded : api;
  const token = auth.session?.accessToken ?? null;
  const { reading, facts, busy, error, read } = useReading(client, subject, token, build, revision);
  if (auth.status === 'disabled' || !configuredUrl) return null;

  const signedIn = auth.status === 'signed-in';
  return (
    <section className="reading" aria-labelledby={`reading-${subject}`}>
      <div className="section-header">
        <h2 id={`reading-${subject}`}>{t('assistant.title')}</h2>
        {signedIn && (reading
          ? <button type="button" className="button button-quiet" disabled={busy} onClick={read}>{t('assistant.again')}</button>
          : <button type="button" className="button button-secondary" disabled={busy || !client} onClick={read}>{t(`assistant.read.${subject}`)}</button>)}
      </div>

      <div className="reading-body">
        <div className="reading-column">
          {!signedIn ? (
            <p className="field-help">
              {t('assistant.signInHelp')}{' '}
              <Link state={{ from: subject === 'analysis' ? ROUTES.analyze : ROUTES.laboratory }} to={ROUTES.signIn}>{t('shell.signIn')}</Link>
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
