import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/errors';
import { useTranslation } from '../../i18n';
import type { Fact, Reading } from './assistantApi';
import type { AssistantApi } from './assistantApi';
import type { ReadingSubject } from './config';

export interface ReadingState {
  reading: Reading | null;
  facts: Fact[] | null;
  busy: boolean;
  error: ApiError | null;
  read: () => void;
}

interface Attempt {
  reading: Reading | null;
  facts: Fact[] | null;
  busy: boolean;
  error: ApiError | null;
  /** The figures and the language this attempt belongs to. */
  revision: string;
}

const EMPTY = { reading: null, facts: null, busy: false, error: null } as const;

/**
 * One reading of one screen. The facts are captured when the reading is asked for, so the figures
 * shown beside the text are the ones that were sent. A reading belongs to the revision it was asked
 * for: once the figures or the language change it is not shown, because it describes what was there
 * before, and a late answer to an abandoned request cannot resurface either.
 */
export function useReading(api: AssistantApi | null, subject: ReadingSubject, token: string | null, build: () => Fact[], revision: string): ReadingState {
  const { locale } = useTranslation();
  const current = `${locale}:${revision}`;
  const [attempt, setAttempt] = useState<Attempt>({ ...EMPTY, revision: current });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);

  const read = useCallback(() => {
    if (!api || !token) return;
    const facts = build();
    const operation = new AbortController();
    controller.current?.abort();
    controller.current = operation;
    setAttempt({ ...EMPTY, busy: true, revision: current });
    void api.interpret(subject, locale, facts, token, operation.signal)
      .then((reading) => {
        if (operation.signal.aborted) return;
        setAttempt({ ...EMPTY, reading, facts, revision: current });
      })
      .catch((error: unknown) => {
        if (operation.signal.aborted) return;
        setAttempt({ ...EMPTY, error: error instanceof ApiError ? error : new ApiError('unknown'), revision: current });
      });
  }, [api, token, subject, locale, current, build]);

  const shown = attempt.revision === current ? attempt : { ...EMPTY, revision: current };
  return { reading: shown.reading, facts: shown.facts, busy: shown.busy, error: shown.error, read };
}
