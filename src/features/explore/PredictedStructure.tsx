import { useEffect, useRef, useState } from 'react';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import type { Structure } from 'molstar/lib/mol-model/structure';
import type { StateObjectSelector } from 'molstar/lib/mol-state';
import { useTranslation } from '../../i18n';
import { useThemeRevision } from '../../theme/useThemeRevision';
import { RESIDUE_CLASS_TOKENS, RESIDUE_NAMES, residueClass } from '../chemistry/config';
import { rotateCamera, zoomCamera } from '../library/camera';
import { MAX_STRUCTURE_BYTES, STRUCTURE_TIMEOUT_MS } from '../library/config';
import { REDUCED_MOTION_QUERY } from '../structure/config';
import { ALPHAFOLD_FILES_URL, CHEMISTRY_THEME_NAME, FOCUS_CAMERA_MS, FOCUS_MARK_TOKEN, UNCLASSIFIED_RESIDUE_TOKEN } from './config';

export interface StructureFocus {
  /** Identifies the stop, so the same residues marked for another stop are still a new focus. */
  readonly key: string;
  readonly positions: readonly number[];
  /** Also draw the side chains of these residues. */
  readonly sticks: boolean;
}

interface Props {
  /** BinaryCIF of a single-chain predicted model whose residue numbers are sequence positions. */
  url: string;
  label: string;
  focus: StructureFocus | null;
  /** What the model shows now, written over it; the reading beside the model says the same for assistive technology. */
  caption?: string | null;
  onPick: (position: number | null) => void;
}

interface Loaded { plugin: PluginContext; structure: StateObjectSelector; data: Structure }
type Runtime = typeof import('../library/molstarRuntime');
type Focusing = typeof import('./structureFocus');
type ChemistryPalette = import('./structureFocus').ChemistryPalette;
type Color = import('molstar/lib/mol-util/color').Color;

interface Tones { palette: ChemistryPalette; mark: Color; background: Color }

/** Colours of the current theme, read from the design tokens around the viewer. */
function readTones(target: HTMLElement, runtime: Runtime): Tones {
  const style = getComputedStyle(target);
  const tone = (token: string) => runtime.Color.fromHexStyle(style.getPropertyValue(token).trim());
  const byResidue = new Map(Object.entries(RESIDUE_NAMES).flatMap(([letter, name]) => {
    const chemistry = residueClass(letter);
    return chemistry ? [[name.toUpperCase(), tone(RESIDUE_CLASS_TOKENS[chemistry])] as const] : [];
  }));
  return { palette: { byResidue, unclassified: tone(UNCLASSIFIED_RESIDUE_TOKEN) }, mark: tone(FOCUS_MARK_TOKEN), background: tone('--bg-subtle') };
}

function canvasColors({ mark, background }: Tones) {
  return {
    renderer: { backgroundColor: background, selectColor: mark, highlightColor: mark },
    marking: { selectEdgeColor: mark, highlightEdgeColor: mark },
  };
}

/** The application's chemistry theme; the name is registered at runtime, outside Mol*'s built-in list. */
function chemistryColor(revision: number) {
  return { color: CHEMISTRY_THEME_NAME as never, colorParams: { revision } as never };
}

/** A predicted model coloured by residue chemistry, with one stop of the tour marked and in view. */
export default function PredictedStructure({ url, label, focus, caption = null, onPick }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const themeRevision = useThemeRevision();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const loaded = useRef<Loaded | null>(null);
  const modules = useRef<{ runtime: Runtime; focusing: Focusing } | null>(null);
  const sticks = useRef<string | null>(null);
  const palette = useRef<ChemistryPalette | null>(null);
  const paletteRevision = useRef(0);
  const work = useRef<Promise<void>>(Promise.resolve());
  const wanted = useRef(focus);
  const pick = useRef(onPick);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { pick.current = onPick; }, [onPick]);

  useEffect(() => {
    const target = container.current; const surface = canvas.current;
    if (!target || !surface || !url.startsWith(ALPHAFOLD_FILES_URL)) return;
    const controller = new AbortController();
    let instance: PluginContext | null = null;
    let active = true;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    const isCurrent = () => active && !controller.signal.aborted;
    const dispose = () => {
      unsubscribe?.();
      if (!disposed && instance) { disposed = true; instance.dispose(); }
      if (loaded.current?.plugin === instance) { loaded.current = null; sticks.current = null; }
    };
    const timer = setTimeout(() => { controller.abort(); dispose(); if (active) setState('error'); }, STRUCTURE_TIMEOUT_MS);
    let visible = true;
    function updateVisibility(): void { if (document.hidden || !visible) instance?.canvas3d?.pause(true); else instance?.canvas3d?.resume(); }
    queueMicrotask(() => { setState('loading'); });
    void (async () => {
      try {
        const [runtime, focusing] = await Promise.all([import('../library/molstarRuntime'), import('./structureFocus')]);
        modules.current = { runtime, focusing };
        if (!isCurrent()) return;
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok || Number(response.headers.get('Content-Length') ?? 0) > MAX_STRUCTURE_BYTES) throw new Error('Invalid model download');
        const bytes = await response.arrayBuffer();
        if (!isCurrent()) return;
        if (!bytes.byteLength || bytes.byteLength > MAX_STRUCTURE_BYTES) throw new Error('Invalid model size');
        const { PluginContext, DefaultPluginSpec } = runtime;
        instance = new PluginContext(DefaultPluginSpec());
        await instance.init();
        if (!isCurrent()) return;
        if (!await instance.initViewerAsync(surface, target)) throw new Error('WebGL unavailable');
        if (!isCurrent()) return;
        const tones = readTones(target, runtime);
        palette.current = tones.palette;
        instance.canvas3d?.setProps({ ...canvasColors(tones), camera: { helper: { axes: { name: 'off', params: {} } } } });
        // The theme reads the latest palette whenever it is built; a theme change rebuilds it with a new revision.
        instance.representation.structure.themes.colorThemeRegistry.add(focusing.chemistryTheme(() => palette.current ?? tones.palette));
        const data = await instance.builders.data.rawData({ data: new Uint8Array(bytes), label: url });
        if (!isCurrent()) return;
        const trajectory = await instance.builders.structure.parseTrajectory(data, 'mmcif');
        if (!isCurrent()) return;
        const model = await instance.builders.structure.createModel(trajectory);
        if (!isCurrent()) return;
        const structure = await instance.builders.structure.createStructure(model, { name: 'model', params: {} });
        if (!isCurrent()) return;
        const polymer = await instance.builders.structure.tryCreateComponentStatic(structure, 'polymer');
        if (!isCurrent()) return;
        if (!polymer || !structure.obj) throw new Error('No polymer coordinates');
        await instance.builders.structure.representation.addRepresentation(polymer, { type: 'cartoon', ...chemistryColor(paletteRevision.current) });
        if (!isCurrent()) return;
        const subscription = instance.behaviors.interaction.click.subscribe(event => {
          if (isCurrent()) pick.current(focusing.positionFromLoci(event.current.loci));
        });
        unsubscribe = () => { subscription.unsubscribe(); };
        instance.canvas3d?.requestCameraReset({ durationMs: 0 });
        loaded.current = { plugin: instance, structure, data: structure.obj.data };
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
  }, [url, attempt]);

  // Marks the stop, brings it into view and, for a short one, draws its side chains.
  useEffect(() => {
    wanted.current = focus;
    const current = loaded.current; const active = modules.current;
    if (state !== 'ready' || !current || !active) return;
    const { plugin, structure, data } = current;
    const durationMs = window.matchMedia(REDUCED_MOTION_QUERY).matches ? 0 : FOCUS_CAMERA_MS;
    const expression = focus?.positions.length ? active.focusing.residuesExpression(focus.positions) : null;
    const loci = expression ? active.focusing.lociOf(data, expression) : null;
    plugin.managers.interactivity.lociSelects.deselectAll();
    if (loci && loci.elements.length > 0) {
      plugin.managers.interactivity.lociSelects.selectOnly({ loci }, false);
      plugin.managers.camera.focusLoci(loci, { durationMs });
    } else {
      plugin.canvas3d?.requestCameraReset({ durationMs });
    }
    // One change at a time: a stop left behind never draws over the one on screen.
    work.current = work.current.then(async () => {
      if (loaded.current?.plugin !== plugin) return;
      if (sticks.current) { const previous = sticks.current; sticks.current = null; await plugin.build().delete(previous).commit(); }
      if (wanted.current !== focus || !focus?.sticks || !expression) return;
      const component = await plugin.builders.structure.tryCreateComponentFromExpression(structure, expression, `stop-${focus.key}`);
      if (!component) return;
      sticks.current = component.ref;
      await plugin.builders.structure.representation.addRepresentation(component, { type: 'ball-and-stick', ...chemistryColor(paletteRevision.current) });
    }).catch(() => { /* The ribbon mark already shows the stop; its side chains are an addition. */ });
  }, [focus, state]);

  // Repaints the background, the mark and every residue in the colours of the theme now on screen.
  useEffect(() => {
    const plugin = loaded.current?.plugin; const target = container.current; const runtime = modules.current?.runtime;
    if (!plugin || !target || !runtime) return;
    const tones = readTones(target, runtime);
    plugin.canvas3d?.setProps(canvasColors(tones));
    palette.current = tones.palette;
    const revision = ++paletteRevision.current;
    work.current = work.current.then(async () => {
      if (loaded.current?.plugin !== plugin) return;
      const components = plugin.managers.structure.hierarchy.current.structures.flatMap(structure => structure.components);
      await plugin.managers.structure.component.updateRepresentationsTheme(components, chemistryColor(revision));
    }).catch(() => { /* The previous colours stay; the model is still readable. */ });
  }, [themeRevision]);

  const plugin = (): PluginContext | null => loaded.current?.plugin ?? null;
  const ready = state === 'ready';
  return <div className="structure-viewer">
    <div className="structure-frame"><div className="structure-canvas" ref={container} role="img" tabIndex={0} aria-label={label} aria-describedby="predicted-structure-instructions" onKeyDown={(event) => {
      if (!ready) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); rotateCamera(plugin(), event.key === 'ArrowLeft' ? -1 : 1); }
      if (event.key === '+' || event.key === '-') { event.preventDefault(); zoomCamera(plugin(), event.key === '+'); }
    }}><canvas ref={canvas} aria-hidden="true" /></div>
      {ready && caption && <p key={caption} className="structure-caption" aria-hidden="true">{caption}</p>}
    </div>
    <p className="status-message" role="status" data-state={state === 'error' ? 'error' : undefined}>{t(state === 'loading' ? 'library.viewerLoading' : ready ? 'library.viewerReady' : 'explore.viewerError')}</p>
    <div className="actions">
      <button className="button button-secondary" type="button" disabled={!ready} onClick={() => { rotateCamera(plugin(), -1); }}>{t('library.rotateLeft')}</button>
      <button className="button button-secondary" type="button" disabled={!ready} onClick={() => { rotateCamera(plugin(), 1); }}>{t('library.rotateRight')}</button>
      <button className="button button-secondary" type="button" disabled={!ready} onClick={() => { zoomCamera(plugin(), true); }}>{t('library.zoomIn')}</button>
      <button className="button button-secondary" type="button" disabled={!ready} onClick={() => { zoomCamera(plugin(), false); }}>{t('library.zoomOut')}</button>
      <button className="button button-secondary" type="button" disabled={!ready} onClick={() => { plugin()?.canvas3d?.requestCameraReset({ durationMs: 0 }); }}>{t('library.resetView')}</button>
      {state === 'error' && <button className="button button-primary" type="button" onClick={() => { setAttempt(value => value + 1); }}>{t('library.retry')}</button>}
    </div>
    <p id="predicted-structure-instructions" className="field-help">{t('explore.viewerInstructions')}</p>
  </div>;
}
