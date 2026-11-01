import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LabContext } from './context';
import type { LabState } from './context';
import { LAB_CONFIG as C , required } from './config';
import type { LabErrorCode } from './config';
import type { LabDataset, LabDraft, LabProgress, LabRequest, LabResponse, LabSavedState } from './types';
import { draftFingerprint, initialDrafts, replaceResidue, restoreSequence, toggleProtection, undoDraft } from './state';
import { downloadLabFile } from './download';
import type { StructurePredictions, ValidatedPrediction } from './prediction';
type LabOrigin = 'example' | 'file' | 'project';
function originOf(request: LabRequest): LabOrigin | null {
    if (request.type === 'example') return 'example';
    if (request.type === 'import') return request.expectedSha256 === undefined ? 'file' : 'project';
    return null;
}
/** In-memory drafts survive navigation; files and explicit project snapshots share Worker validation. */
export function LabProvider({ children }: {
    children: ReactNode;
}): React.JSX.Element {
    const [dataset, setDataset] = useState<LabDataset | null>(null), [drafts, setDrafts] = useState<Record<string, LabDraft>>({});
    const [activeId, setActiveId] = useState(''), [selected, setSelected] = useState(0);
    const [predictions,setPredictions]=useState<StructurePredictions|null>(null);
    const currentPredictions=useRef(predictions);
    useLayoutEffect(()=>{currentPredictions.current=predictions;},[predictions]);
    const [status, setStatus] = useState<LabState['status']>('idle'), [error, setError] = useState<LabErrorCode | null>(null), [progress, setProgress] = useState<LabProgress | null>(null);
    const statusRef=useRef(status);
    useLayoutEffect(()=>{statusRef.current=status;},[status]);
    const [dirty, setDirty] = useState(false), [exported, setExported] = useState(false);
    // Where the loaded dataset and the in-flight load come from; a user file or project is never replaceable.
    const [origin, setOrigin] = useState<LabOrigin | null>(null), [loadingOrigin, setLoadingOrigin] = useState<LabOrigin | null>(null);
    const savedFingerprint=useRef('');
    const currentDrafts=useRef(drafts);
    useLayoutEffect(()=>{currentDrafts.current=drafts;},[drafts]);
    const [revision, setRevision] = useState(0), revisionRef = useRef(0);
    const pending = useRef<((result: { bytes?: Uint8Array<ArrayBuffer>; revision: number } | null) => void) | null>(null);
    const worker = useRef<Worker | null>(null), requestId = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), archive = useRef<ArrayBuffer | null>(null);
    const stop = useCallback(() => { pending.current?.(null); pending.current=null; requestId.current++; worker.current?.terminate(); worker.current = null; if (timer.current)
        clearTimeout(timer.current); timer.current = null; }, []);
    useEffect(() => stop, [stop]);
    useEffect(() => { if (!dirty)
        return; const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => { window.removeEventListener('beforeunload', warn); }; }, [dirty]);
    const fail = useCallback((code: LabErrorCode, id: number) => { if (id !== requestId.current)
        return; stop(); setStatus('error'); setError(code); setProgress(null); }, [stop]);
    const launch = useCallback((request: LabRequest, download = true) => {
        let settle: (result: { bytes?: Uint8Array<ArrayBuffer>; revision: number } | null) => void = () => {};
        const completion = new Promise<{ bytes?: Uint8Array<ArrayBuffer>; revision: number } | null>(resolve => { settle=resolve; });
        pending.current=settle;
        if (request.id !== requestId.current)
            { settle(null); return completion; }
        const requestOrigin = originOf(request);
        setLoadingOrigin(requestOrigin);
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
                        if(download){
                            downloadLabFile(response.bytes, C.workspaceFilename, 'application/json');
                            savedFingerprint.current=draftFingerprint(request.state.drafts,request.predictions);
                            setDirty(false);
                            setExported(true);
                        }
                        settle({bytes:response.bytes,revision:revisionRef.current}); pending.current=null;
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
                    const nextPredictions=result.predictions??null;
                    setPredictions(nextPredictions); currentPredictions.current=nextPredictions;
                    savedFingerprint.current=draftFingerprint(nextDrafts,nextPredictions);
                    setDrafts(nextDrafts);
                    currentDrafts.current=nextDrafts;
                    setActiveId(result.saved?.activeId ?? required(result.dataset.variants[0]).id);
                    setSelected(result.saved?.selected ?? 0);
                    setDirty(false);
                    setExported(false);
                    setOrigin(requestOrigin);
                    revisionRef.current++; setRevision(revisionRef.current);
                    settle({revision:revisionRef.current}); pending.current=null;
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
        return completion;
    }, [fail, stop]);
    const begin = useCallback((exporting = false) => { stop(); setStatus(exporting ? 'exporting' : 'loading'); setLoadingOrigin(null); setError(null); setProgress(null); return requestId.current; }, [stop]);
    const openExample = useCallback(() => { void launch({ id: begin(), type: 'example' }); }, [begin, launch]);
    const openFile = useCallback((file: File) => {
        const id = begin();
        if (file.size > C.maximumWorkspaceBytes) {
            fail('size', id);
            return;
        }
        void file.arrayBuffer().then(bytes => { if (id === requestId.current)
            void launch({ id, type: 'import', bytes }); }).catch(() => { fail('schema', id); });
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
        let nextPredictions=currentPredictions.current;
        if(next.sequence!==current.sequence && nextPredictions && activeId in nextPredictions){
            nextPredictions=Object.fromEntries(Object.entries(nextPredictions).filter(([id])=>id!==activeId));
            setPredictions(nextPredictions); currentPredictions.current=nextPredictions;
        }
        setDrafts(nextDrafts);
        currentDrafts.current=nextDrafts;
        setDirty(draftFingerprint(nextDrafts,nextPredictions)!==savedFingerprint.current);
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
        void launch({ id: begin(true), type: 'export', archive: archive.current, state, predictions:currentPredictions.current });
    }, [dataset, status, activeId, selected, drafts, launch, begin]);
    const document = useCallback(async () => {
        if(!dataset || status==='loading' || status==='exporting')return null;
        const state:LabSavedState={activeId,selected,drafts:Object.fromEntries(Object.entries(drafts).map(([id,draft])=>[id,{sequence:draft.sequence,protectedPositions:draft.protectedPositions}]))};
        return (await launch({id:begin(true),type:'export',archive:archive.current,state,predictions:currentPredictions.current},false))?.bytes ?? null;
    },[dataset,status,activeId,selected,drafts,launch,begin]);
    const openDocument=useCallback(async(bytes:ArrayBuffer,sha256:string)=>{
        if(bytes.byteLength>C.maximumProjectBytes)return null;
        return (await launch({id:begin(),type:'import',bytes,expectedSha256:sha256}))?.revision ?? null;
    },[begin,launch]);
    const markSaved=useCallback((fingerprint:string)=>{savedFingerprint.current=fingerprint;setDirty(draftFingerprint(currentDrafts.current,currentPredictions.current)!==fingerprint);},[]);
    const storePrediction=useCallback((variantId:string,expectedRevision:number,result:ValidatedPrediction)=>{
        if(expectedRevision!==revisionRef.current || statusRef.current==='loading' || statusRef.current==='exporting' || currentDrafts.current[variantId]?.sequence!==result.prediction.sequence)return false;
        const next={...currentPredictions.current,[variantId]:result.prediction};
        setPredictions(next);currentPredictions.current=next;
        setDirty(draftFingerprint(currentDrafts.current,next)!==savedFingerprint.current);setExported(false);return true;
    },[]);
    const replaceable = !dirty && status !== 'exporting' && (status === 'loading' ? loadingOrigin === 'example' : origin === null || origin === 'example');
    const value = useMemo(() => ({ dataset, drafts, activeId, selected, status, error, progress, dirty, exported, replaceable, openExample, openFile, cancel, selectVariant, selectResidue, substitute, protect, undo, restore, save, revision,document,openDocument,markSaved,predictions,storePrediction }), [dataset, drafts, activeId, selected, status, error, progress, dirty, exported, replaceable, openExample, openFile, cancel, selectVariant, selectResidue, substitute, protect, undo, restore, save,revision,document,openDocument,markSaved,predictions,storePrediction]);
    return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
