import { useEffect, useRef, useState } from 'react';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { useTranslation } from '../../i18n';
import { useThemeRevision } from '../../theme/useThemeRevision';
import { CAMERA_ROTATION_RADIANS, CAMERA_ZOOM_FACTOR, MAX_STRUCTURE_BYTES, STRUCTURE_DOWNLOAD_URL, STRUCTURE_TIMEOUT_MS } from './config';

/** A small Spanish control surface over Mol*. Only real public BinaryCIF is rendered. */
export default function StructureViewer({ pdbId }: { pdbId: string }): React.JSX.Element {
  const { t } = useTranslation();
  const themeRevision = useThemeRevision();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const plugin = useRef<PluginContext | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const target = container.current; const surface = canvas.current;
    if (!target || !surface || !/^[0-9][A-Z0-9]{3}$/.test(pdbId)) return;
    const controller = new AbortController();
    let instance: PluginContext | null = null;
    let active = true;
    let disposed = false;
    const isCurrent = () => active && !controller.signal.aborted;
    const dispose = () => { if (!disposed && instance) { disposed = true; instance.dispose(); } if (plugin.current === instance) plugin.current = null; };
    const timer = setTimeout(() => { controller.abort(); dispose(); if (active) setState('error'); }, STRUCTURE_TIMEOUT_MS);
    let visible = true;
    function updateVisibility(): void { if (document.hidden || !visible) instance?.canvas3d?.pause(true); else instance?.canvas3d?.resume(); }
    queueMicrotask(() => { setState('loading'); });
    void (async () => {
      try {
        const { PluginContext, DefaultPluginSpec, Color } = await import('./molstarRuntime');
        if (!isCurrent()) return;
        const response = await fetch(`${STRUCTURE_DOWNLOAD_URL}${pdbId.toLowerCase()}.bcif`, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok || Number(response.headers.get('Content-Length') ?? 0) > MAX_STRUCTURE_BYTES) throw new Error('Invalid structure download');
        const bytes = await response.arrayBuffer();
        if (!isCurrent()) return;
        if (!bytes.byteLength || bytes.byteLength > MAX_STRUCTURE_BYTES) throw new Error('Invalid structure size');
        instance = new PluginContext(DefaultPluginSpec());
        plugin.current = instance;
        await instance.init();
        if (!isCurrent()) return;
        if (!await instance.initViewerAsync(surface, target)) throw new Error('WebGL unavailable');
        instance.canvas3d?.setProps({ renderer: { backgroundColor: Color.fromHexStyle(getComputedStyle(target).getPropertyValue('--bg-raised').trim()) } });
        const data = await instance.builders.data.rawData({ data: new Uint8Array(bytes), label: pdbId });
        const trajectory = await instance.builders.structure.parseTrajectory(data, 'mmcif');
        const model = await instance.builders.structure.createModel(trajectory);
        const structure = await instance.builders.structure.createStructure(model, { name: 'model', params: {} });
        const polymer = await instance.builders.structure.tryCreateComponentStatic(structure, 'polymer');
        if (!polymer) throw new Error('No polymer coordinates');
        await instance.builders.structure.representation.addRepresentation(polymer, { type: 'cartoon', color: 'chain-id' });
        if (!isCurrent()) return;
        instance.canvas3d?.requestCameraReset({ durationMs: 0 });
        updateVisibility();
        setState('ready');
      } catch {
        dispose();
        if (isCurrent()) setState('error');
      } finally { clearTimeout(timer); }
    })();
    const resize = new ResizeObserver(() => { instance?.canvas3d?.requestResize(); });
    resize.observe(target);
    const observer = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); updateVisibility(); });
    observer.observe(target);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      active = false;
      controller.abort(); clearTimeout(timer); resize.disconnect(); observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
      dispose();
    };
  }, [pdbId, attempt]);

  useEffect(() => {
    const instance = plugin.current; const target = container.current;
    if (!instance || !target) return;
    void import('./molstarRuntime').then(({ Color }) => {
      if (plugin.current === instance) instance.canvas3d?.setProps({ renderer: { backgroundColor: Color.fromHexStyle(getComputedStyle(target).getPropertyValue('--bg-raised').trim()) } });
    });
  }, [themeRevision]);

  function rotate(direction: number): void {
    const camera = plugin.current?.canvas3d?.camera;
    if (!camera) return;
    const snapshot = camera.getSnapshot();
    const angle = CAMERA_ROTATION_RADIANS * direction;
    const targetX = snapshot.target[0] ?? 0; const targetZ = snapshot.target[2] ?? 0;
    const x = (snapshot.position[0] ?? 0) - targetX; const z = (snapshot.position[2] ?? 0) - targetZ;
    snapshot.position[0] = targetX + x * Math.cos(angle) - z * Math.sin(angle);
    snapshot.position[2] = targetZ + x * Math.sin(angle) + z * Math.cos(angle);
    camera.setState({ position: snapshot.position }, 0);
  }
  function zoom(inward: boolean): void {
    const camera = plugin.current?.canvas3d?.camera;
    if (camera) camera.setState({ radius: Math.max(0.1, camera.getSnapshot().radius * (inward ? CAMERA_ZOOM_FACTOR : 1 / CAMERA_ZOOM_FACTOR)) }, 0);
  }
  return <div className="structure-viewer">
    <div className="structure-canvas" ref={container} role="img" tabIndex={0} aria-label={t('library.viewerLabel', { id: pdbId })} aria-describedby="structure-instructions" onKeyDown={(event) => {
      if (state !== 'ready') return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); rotate(event.key === 'ArrowLeft' ? -1 : 1); }
      if (event.key === '+' || event.key === '-') { event.preventDefault(); zoom(event.key === '+'); }
    }}><canvas ref={canvas} aria-hidden="true" /></div>
    <p className="status-message" role="status" data-state={state === 'error' ? 'error' : undefined}>{t(state === 'loading' ? 'library.viewerLoading' : state === 'ready' ? 'library.viewerReady' : 'library.viewerError')}</p>
    <div className="hero-actions">
      <button className="button button-secondary" type="button" disabled={state !== 'ready'} onClick={() => { rotate(-1); }}>{t('library.rotateLeft')}</button>
      <button className="button button-secondary" type="button" disabled={state !== 'ready'} onClick={() => { rotate(1); }}>{t('library.rotateRight')}</button>
      <button className="button button-secondary" type="button" disabled={state !== 'ready'} onClick={() => { zoom(true); }}>{t('library.zoomIn')}</button>
      <button className="button button-secondary" type="button" disabled={state !== 'ready'} onClick={() => { zoom(false); }}>{t('library.zoomOut')}</button>
      <button className="button button-secondary" type="button" disabled={state !== 'ready'} onClick={() => { plugin.current?.canvas3d?.requestCameraReset({ durationMs: 0 }); }}>{t('library.resetView')}</button>
      {state === 'error' && <button className="button button-primary" type="button" onClick={() => { setAttempt((value) => value + 1); }}>{t('library.retry')}</button>}
    </div>
    <p id="structure-instructions" className="field-help">{t('library.viewerInstructions')}</p>
    <p className="field-help">{t('library.viewerScope')}</p>
  </div>;
}
