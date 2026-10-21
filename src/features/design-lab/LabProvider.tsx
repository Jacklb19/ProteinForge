import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LabContext } from './context';
import type { LabState } from './context';
import { LAB_CONFIG as C , required } from './config';
import type { LabErrorCode } from './config';
import type { LabDataset, LabDraft, LabProgress, LabRequest, LabResponse, LabSavedState } from './types';
import { draftFingerprint, initialDrafts, replaceResidue, restoreSequence, toggleProtection, undoDraft } from './state';
import { downloadLabFile } from './download';
/** In-memory drafts survive navigation. Saving is an explicit local file download, independent of an account. */
export function LabProvider({ children }: {
    children: ReactNode;
}): React.JSX.Element {
    const [dataset, setDataset] = useState<LabDataset | null>(null), [drafts, setDrafts] = useState<Record<string, LabDraft>>({});
    const [activeId, setActiveId] = useState(''), [selected, setSelected] = useState(0);
    const [status, setStatus] = useState<LabState['status']>('idle'), [error, setError] = useState<LabErrorCode | null>(null), [progress, setProgress] = useState<LabProgress | null>(null);
    const [dirty, setDirty] = useState(false), [exported, setExported] = useState(false);
    const savedFingerprint=useRef('');
    const worker = useRef<Worker | null>(null), requestId = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), archive = useRef<ArrayBuffer | null>(null);
    const stop = useCallback(() => { requestId.current++; worker.current?.terminate(); worker.current = null; if (timer.current)
        clearTimeout(timer.current); timer.current = null; }, []);
    useEffect(() => stop, [stop]);
    useEffect(() => { if (!dirty)
        return; const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => { window.removeEventListener('beforeunload', warn); }; }, [dirty]);
    const fail = useCallback((code: LabErrorCode, id: number) => { if (id !== requestId.current)
        return; stop(); setStatus('error'); setError(code); setProgress(null); }, [stop]);
    const launch = useCallback((request: LabRequest) => {
        if (request.id !== requestId.current)
            return;
        try {
            const instance = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
            worker.current = instance;
            instance.onerror = () => { fail('worker', request.id); };
            instance.onmessage = (event: MessageEvent<LabResponse>) => {
                const response = event.data;
                if (response.id !== requestId.current)
                    return;
                if (response.type === 'progress') {
                    setProgress(response.progress);
                    return;
                }
                if (response.type === 'error') {
                    fail(response.code, request.id);
                    return;
                }
                if (response.type === 'export') {
                    if(request.type!=='export'){fail('worker',request.id);return;}
                    try {
                        downloadLabFile(response.bytes, C.workspaceFilename, 'application/json');
                        savedFingerprint.current=draftFingerprint(request.state.drafts);
                        setDirty(false);
                        setExported(true);
                    }
                    catch {
                        fail('worker', request.id);
                        return;
                    }
                }
                else {
                    const result = response.result;
                    archive.current = result.archive;
                    setDataset(result.dataset);
                    const nextDrafts=initialDrafts(result.dataset, result.saved);
                    savedFingerprint.current=draftFingerprint(nextDrafts);
                    setDrafts(nextDrafts);
                    setActiveId(result.saved?.activeId ?? required(result.dataset.variants[0]).id);
                    setSelected(result.saved?.selected ?? 0);
                    setDirty(false);
                    setExported(false);
                }
                stop();
                setStatus('ready');
                setProgress(null);
                setError(null);
            };
            timer.current = setTimeout(() => { fail('timeout', request.id); }, C.timeoutMs);
            instance.postMessage(request, request.type === 'import' ? [request.bytes] : []);
        }
        catch {
            fail('worker', request.id);
        }
    }, [fail, stop]);
    const begin = useCallback((exporting = false) => { stop(); setStatus(exporting ? 'exporting' : 'loading'); setError(null); setProgress(null); return requestId.current; }, [stop]);
    const openExample = useCallback(() => { launch({ id: begin(), type: 'example' }); }, [begin, launch]);
    const openFile = useCallback((file: File) => {
        const id = begin();
        if (file.size > C.maximumWorkspaceBytes) {
            fail('size', id);
            return;
        }
        void file.arrayBuffer().then(bytes => { if (id === requestId.current)
            launch({ id, type: 'import', bytes }); }).catch(() => { fail('schema', id); });
    }, [begin, fail, launch]);
    const cancel = useCallback(() => { stop(); setStatus('cancelled'); setProgress(null); setError(null); }, [stop]);
    const selectVariant = useCallback((id: string) => { if (dataset?.variants.some(variant => variant.id === id)) {
        setActiveId(id);
    } }, [dataset]);
    const selectResidue = useCallback((index: number) => { const variant = dataset?.variants.find(variant => variant.id === activeId); if (variant && Number.isInteger(index) && index >= 0 && index < variant.sequence.length)
        setSelected(index); }, [dataset, activeId]);
    const change = useCallback((update: (draft: LabDraft) => LabDraft) => {
        if (status === 'loading' || status === 'exporting')
            return;
        const current = drafts[activeId];
        if (!current)
            return;
        const next = update(current);
        if (current === next)
            return;
        const nextDrafts={ ...drafts, [activeId]: next };
        setDrafts(nextDrafts);
        setDirty(draftFingerprint(nextDrafts)!==savedFingerprint.current);
        setExported(false);
    }, [drafts, activeId, status]);
    const substitute = useCallback((aa: string) => { change(draft => replaceResidue(draft, selected, aa)); }, [change, selected]);
    const protect = useCallback(() => { change(draft => toggleProtection(draft, selected)); }, [change, selected]);
    const undo = useCallback(() => { change(undoDraft); }, [change]);
    const restore = useCallback(() => { const variant = dataset?.variants.find(variant => variant.id === activeId); if (variant)
        change(draft => restoreSequence(draft, variant.sequence)); }, [dataset, activeId, change]);
    const save = useCallback(() => {
        if (!dataset || status === 'loading' || status === 'exporting')
            return;
        const state: LabSavedState = { activeId, selected, drafts: Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id, { sequence: draft.sequence, protectedPositions: draft.protectedPositions }])) };
        launch({ id: begin(true), type: 'export', archive: archive.current, state });
    }, [dataset, status, activeId, selected, drafts, launch, begin]);
    const value = useMemo(() => ({ dataset, drafts, activeId, selected, status, error, progress, dirty, exported, openExample, openFile, cancel, selectVariant, selectResidue, substitute, protect, undo, restore, save }), [dataset, drafts, activeId, selected, status, error, progress, dirty, exported, openExample, openFile, cancel, selectVariant, selectResidue, substitute, protect, undo, restore, save]);
    return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
