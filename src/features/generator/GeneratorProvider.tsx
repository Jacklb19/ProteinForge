import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GeneratorContext, INITIAL_SEARCH_FORM, parseSearchForm } from './context';
import type { GeneratorState, SearchForm } from './context';
import type { SearchProgress, SearchResult } from './search';
import type { SearchRequest, SearchResponse } from './messages';
import { GENERATOR_CONFIG } from './config';

/** In-memory run state survives route changes; reload deliberately discards it. */
export function GeneratorProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [form, setFormState] = useState(INITIAL_SEARCH_FORM);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [status, setStatus] = useState<GeneratorState['status']>('idle');
  const worker = useRef<Worker | null>(null); const requestId = useRef(0); const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback(() => { requestId.current += 1; worker.current?.terminate(); worker.current = null; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; }, []);
  useEffect(() => stop, [stop]);
  const cancel = useCallback(() => { stop(); setStatus('cancelled'); setProgress(null); }, [stop]);
  const setForm = useCallback((changes: Partial<SearchForm>) => { setFormState((current) => ({ ...current, ...changes })); }, []);
  const run = useCallback(() => {
    const parsed = parseSearchForm(form);
    stop();
    if (!parsed.success) { setStatus('invalid'); return; }
    setStatus('running'); setProgress({ completed: 0, total: parsed.data.budget * 2 });
    const id = requestId.current;
    try {
      const instance = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      const fail = (): void => { if (requestId.current !== id) return; stop(); setStatus('error'); setProgress(null); };
      instance.onerror = fail;
      instance.onmessage = (event: MessageEvent<SearchResponse>) => {
        if (event.data.id !== requestId.current) return;
        if (event.data.type === 'progress') setProgress(event.data.progress);
        else if (event.data.type === 'result') { setResult(event.data.result); stop(); setStatus('done'); setProgress(null); }
        else fail();
      };
      timeout.current = setTimeout(fail, GENERATOR_CONFIG.timeoutMs);
      instance.postMessage({ id, parameters: parsed.data } satisfies SearchRequest);
    } catch { stop(); setStatus('error'); setProgress(null); }
  }, [form, stop]);
  const restore = useCallback((saved: SearchResult) => {
    stop();
    const { length, budget, seed, gravy, massDa } = saved.parameters;
    setFormState({
      length: String(length), budget: String(budget), seed: String(seed),
      gravyEnabled: gravy.enabled, gravyMinimum: String(gravy.minimum), gravyMaximum: String(gravy.maximum),
      massEnabled: massDa.enabled, massMinimum: String(massDa.minimum), massMaximum: String(massDa.maximum),
    });
    setResult(saved); setStatus('done'); setProgress(null);
  }, [stop]);
  const value = useMemo(() => ({ form, setForm, result, progress, status, run, cancel, restore }), [form, setForm, result, progress, status, run, cancel, restore]);
  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>;
}
