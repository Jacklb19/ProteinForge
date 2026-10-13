import { useCallback, useEffect, useRef } from 'react';
import { RESIDUE_CLASSES, RESIDUE_CLASS_TOKENS, residueClass } from '../chemistry/config';
import type { ResidueClass } from '../chemistry/config';
import { HYDROPATHY } from '../descriptors/descriptors';
import { useThemeRevision } from '../../theme/useThemeRevision';
import { INSULIN_BACKBONE, layoutBackbone, oneLetter, pickAnchor } from './backbone';
import type { BackboneModel, BackboneScene, SceneSegment } from './backbone';
import {
  BRIDGE_WIDTH_FACTOR, DEPTH_FOG, DEPTH_WIDTH_BASE, DEPTH_WIDTH_GAIN, DRAG_RADIANS_PER_PIXEL, DRAG_THRESHOLD_PX, HYDROPATHY_EXTREME,
  IDLE_RADIANS_PER_SECOND, INITIAL_PITCH, INITIAL_YAW, KEY_STEP_RADIANS, LABEL_FONT_SIZE, LABEL_OPACITY, LABEL_PADDING,
  OUTLINE_EXTRA_WIDTH, OUTLINE_MIX, PICK_RADIUS_FACTOR, PITCH_LIMIT, REDUCED_MOTION_QUERY, SELECTION_LINE_WIDTH, SELECTION_RADIUS_FACTOR,
  SHEEN_MIX, SHEEN_OFFSET_X, SHEEN_OFFSET_Y, SHEEN_WIDTH_FACTOR, SULFUR_WIDTH_FACTOR,
} from './config';
import type { ColorMode } from './config';

type Rgb = readonly [number, number, number];
const WHITE: Rgb = [255, 255, 255];

export interface ResidueSelection { chain: string; number: number }

interface Props {
  /** Accessible name of the drawing. */
  label: string;
  /** Element describing how to turn it. */
  describedBy?: string;
  colorMode: ColorMode;
  selected?: ResidueSelection | null;
  selectedLabel?: string;
  onSelect?: (selection: ResidueSelection) => void;
  /** Chain termini are labeled on large stages only. */
  showEnds?: boolean;
  /** Turns slowly until the visitor interacts; never with reduced motion. */
  idleTurn?: boolean;
  model?: BackboneModel;
}

function parseColor(value: string): Rgb {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? Array.from(hex, (digit) => digit + digit).join('') : hex;
  const channel = (start: number): number => Number.parseInt(full.slice(start, start + 2), 16) || 0;
  return [channel(0), channel(2), channel(4)];
}

function blend(from: Rgb, to: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((index) => Math.round((from[index] ?? 0) + ((to[index] ?? 0) - (from[index] ?? 0)) * amount)) as unknown as Rgb;
}

const css = (color: Rgb): string => `rgb(${color.join(',')})`;

interface Palette { stage: Rgb; ink: Rgb; classes: Record<ResidueClass, Rgb>; font: string }

function readPalette(element: HTMLElement): Palette {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string): Rgb => parseColor(root.getPropertyValue(name));
  return {
    stage: token('--bg-subtle'),
    ink: token('--text-primary'),
    classes: Object.fromEntries(RESIDUE_CLASSES.map((name) => [name, token(RESIDUE_CLASS_TOKENS[name])])) as Record<ResidueClass, Rgb>,
    font: `600 ${String(LABEL_FONT_SIZE)}px ${getComputedStyle(element).fontFamily}`,
  };
}

function segmentColor(segment: SceneSegment, mode: ColorMode, palette: Palette): Rgb {
  if (segment.kind !== 'tube') return palette.classes.cysteine;
  const residue = oneLetter(segment.residue.name);
  if (mode === 'chain') return segment.chain === 'A' ? palette.classes.hydrophobic : palette.classes.basic;
  if (mode === 'hydropathy') {
    const value = (HYDROPATHY[residue] ?? 0) / HYDROPATHY_EXTREME;
    return blend(palette.classes.special, value > 0 ? palette.classes.hydrophobic : palette.classes.basic, Math.min(1, Math.abs(value)));
  }
  return palette.classes[residueClass(residue) ?? 'special'];
}

function paint(context: CanvasRenderingContext2D, scene: BackboneScene, width: number, height: number, mode: ColorMode, palette: Palette, options: { selected?: ResidueSelection | null; selectedLabel?: string; showEnds: boolean }): void {
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const segment of scene.segments) {
    const factor = segment.kind === 'bridge' ? BRIDGE_WIDTH_FACTOR : segment.kind === 'sulfur' ? SULFUR_WIDTH_FACTOR : 1;
    const lineWidth = scene.tubeWidth * factor * (DEPTH_WIDTH_BASE + DEPTH_WIDTH_GAIN * segment.depth);
    const fog = (1 - segment.depth) * DEPTH_FOG;
    const color = segmentColor(segment, mode, palette);
    const stroke = (style: Rgb, strokeWidth: number, offsetX = 0, offsetY = 0, fromBefore = true): void => {
      context.strokeStyle = css(blend(style, palette.stage, fog));
      context.lineWidth = strokeWidth;
      context.beginPath();
      if (fromBefore) context.moveTo(segment.before[0] + offsetX, segment.before[1] + offsetY);
      else context.moveTo(segment.from[0] + offsetX, segment.from[1] + offsetY);
      context.lineTo(segment.from[0] + offsetX, segment.from[1] + offsetY);
      context.lineTo(segment.to[0] + offsetX, segment.to[1] + offsetY);
      context.stroke();
    };
    // Outline first, then the body drawn back over the previous step so no rings appear between steps.
    stroke(blend(color, palette.ink, OUTLINE_MIX), lineWidth + OUTLINE_EXTRA_WIDTH, 0, 0, false);
    stroke(color, lineWidth);
    stroke(blend(color, WHITE, SHEEN_MIX), lineWidth * SHEEN_WIDTH_FACTOR, -lineWidth * SHEEN_OFFSET_X, -lineWidth * SHEEN_OFFSET_Y);
  }
  const label = (text: string, x: number, y: number): void => {
    context.font = palette.font;
    const textWidth = context.measureText(text).width;
    context.globalAlpha = LABEL_OPACITY;
    context.fillStyle = css(palette.stage);
    context.fillRect(x - LABEL_PADDING, y - LABEL_FONT_SIZE, textWidth + 2 * LABEL_PADDING, LABEL_FONT_SIZE + LABEL_PADDING + 1);
    context.globalAlpha = 1;
    context.fillStyle = css(palette.ink);
    context.fillText(text, x, y);
  };
  if (options.showEnds) {
    const chains = new Map<string, typeof scene.anchors>();
    for (const anchor of scene.anchors) chains.set(anchor.chain, [...(chains.get(anchor.chain) ?? []), anchor]);
    for (const [chain, anchors] of chains) {
      const first = anchors[0];
      const last = anchors.at(-1);
      if (first) label(`${chain}${String(first.residue.number)}`, first.x + scene.tubeWidth, first.y - LABEL_PADDING);
      if (last && last !== first) label(`${chain}${String(last.residue.number)}`, last.x + scene.tubeWidth, last.y + LABEL_FONT_SIZE);
    }
  }
  const selection = options.selected;
  if (selection) {
    const anchor = scene.anchors.find((entry) => entry.chain === selection.chain && entry.residue.number === selection.number);
    if (anchor) {
      const radius = scene.tubeWidth * SELECTION_RADIUS_FACTOR;
      context.strokeStyle = css(palette.ink);
      context.lineWidth = SELECTION_LINE_WIDTH;
      context.beginPath();
      context.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
      context.stroke();
      if (options.selectedLabel) label(options.selectedLabel, anchor.x + radius + LABEL_PADDING, anchor.y + LABEL_PADDING);
    }
  }
}

/**
 * Shaded tube through the measured Cα atoms of a small structure, with its disulfide bridges.
 * Drag or use the arrow keys to turn it; a click selects the nearest residue.
 */
export function BackboneView({ label, describedBy, colorMode, selected = null, selectedLabel, onSelect, showEnds = false, idleTurn = false, model = INSULIN_BACKBONE }: Props): React.JSX.Element {
  const themeRevision = useThemeRevision();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: INITIAL_YAW, pitch: INITIAL_PITCH });
  const scene = useRef<BackboneScene | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const touched = useRef(false);
  const latest = useRef({ colorMode, selected, selectedLabel, showEnds, model });

  const draw = useCallback(() => {
    const element = canvas.current;
    const container = frame.current;
    if (!element || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    const scale = Math.max(1, window.devicePixelRatio || 1);
    if (element.width !== Math.round(width * scale) || element.height !== Math.round(height * scale)) {
      element.width = Math.round(width * scale);
      element.height = Math.round(height * scale);
    }
    const context = element.getContext('2d');
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const current = latest.current;
    scene.current = layoutBackbone(current.model, { ...view.current, width, height });
    paint(context, scene.current, width, height, current.colorMode, readPalette(container), current);
  }, []);

  useEffect(() => {
    latest.current = { colorMode, selected, selectedLabel, showEnds, model };
    draw();
  }, [colorMode, selected, selectedLabel, showEnds, model, themeRevision, draw]);

  useEffect(() => {
    const container = frame.current;
    if (!container) return;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
    observer?.observe(container);
    const fonts = (document as { fonts?: FontFaceSet }).fonts;
    if (fonts) void fonts.ready.then(draw);
    return () => { observer?.disconnect(); };
  }, [draw]);

  useEffect(() => {
    const container = frame.current;
    if (!idleTurn || !container || typeof window.matchMedia !== 'function' || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    let handle = 0;
    let previous: number | null = null;
    let visible = true;
    const step = (time: number): void => {
      if (touched.current) return;
      if (visible && !document.hidden && previous !== null) {
        view.current.yaw += ((time - previous) / 1000) * IDLE_RADIANS_PER_SECOND;
        draw();
      }
      previous = time;
      handle = window.requestAnimationFrame(step);
    };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); })
      : null;
    observer?.observe(container);
    handle = window.requestAnimationFrame(step);
    return () => { window.cancelAnimationFrame(handle); observer?.disconnect(); };
  }, [idleTurn, draw]);

  const turnBy = (yaw: number, pitch: number): void => {
    touched.current = true;
    view.current.yaw += yaw;
    view.current.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, view.current.pitch + pitch));
    draw();
  };

  return (
    <div
      ref={frame}
      className="backbone-view"
      role="group"
      tabIndex={0}
      aria-label={label}
      aria-describedby={describedBy}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const deltaX = event.clientX - current.x;
        const deltaY = event.clientY - current.y;
        if (!current.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
        drag.current = { x: event.clientX, y: event.clientY, moved: true };
        turnBy(deltaX * DRAG_RADIANS_PER_PIXEL, deltaY * DRAG_RADIANS_PER_PIXEL);
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        if (!current || current.moved || !onSelect || !scene.current) return;
        touched.current = true;
        const bounds = event.currentTarget.getBoundingClientRect();
        const anchor = pickAnchor(scene.current, event.clientX - bounds.left, event.clientY - bounds.top, scene.current.tubeWidth * PICK_RADIUS_FACTOR);
        if (anchor) onSelect({ chain: anchor.chain, number: anchor.residue.number });
      }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(event) => {
        const turns: Record<string, readonly [number, number]> = {
          ArrowLeft: [-KEY_STEP_RADIANS, 0], ArrowRight: [KEY_STEP_RADIANS, 0], ArrowUp: [0, -KEY_STEP_RADIANS], ArrowDown: [0, KEY_STEP_RADIANS],
        };
        const turn = turns[event.key];
        if (!turn) return;
        event.preventDefault();
        turnBy(turn[0], turn[1]);
      }}
    >
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
