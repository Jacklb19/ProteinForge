import { useEffect, useMemo, useRef } from 'react';
import { helixAtoms, projectAtoms } from './helix';
import { HELIX_GEOMETRY, HELIX_SCENE } from './config';
import { useTranslation } from '../../i18n';
import { useThemeRevision } from '../../theme/useThemeRevision';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Colors resolved from the design tokens on each frame request, so theme changes repaint. */
function palette(): { backbone: string; atom: string; bond: string; surface: string } {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string) => root.getPropertyValue(name).trim();
  return { backbone: token('--text-primary'), atom: token('--accent-brand'), bond: token('--chain-hydrophobic'), surface: token('--bg-raised') };
}

/** A slowly turning ideal α-helix drawn on a canvas; it pauses off screen and stands still with reduced motion. */
export function HelixScene(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const themeRevision = useThemeRevision();
  const canvas = useRef<HTMLCanvasElement>(null);
  const atoms = useMemo(() => helixAtoms(HELIX_GEOMETRY), []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let frame = 0;
    let visible = true;
    let start = performance.now();

    const draw = (now: number) => {
      const bounds = element.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      if (element.width !== width * ratio || element.height !== height * ratio) {
        element.width = width * ratio;
        element.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const colors = palette();
      const rotation = reducedMotion.matches ? HELIX_SCENE.restRotation : ((now - start) / 1000) * HELIX_SCENE.rotationPerSecond * 2 * Math.PI;
      const scale = Math.min(width, height) / HELIX_SCENE.viewAngstrom;
      const projected = projectAtoms(atoms, { rotation, tilt: HELIX_SCENE.tilt, scale, width, height, perspective: HELIX_SCENE.perspective });

      context.lineCap = 'round';
      context.lineJoin = 'round';
      for (let index = 0; index + HELIX_GEOMETRY.hydrogenBondOffset < projected.length; index += 1) {
        const a = projected[index];
        const b = projected[index + HELIX_GEOMETRY.hydrogenBondOffset];
        if (!a || !b) continue;
        context.globalAlpha = HELIX_SCENE.bondOpacity * (0.4 + 0.6 * Math.min(a.depth, b.depth));
        context.strokeStyle = colors.bond;
        context.lineWidth = HELIX_SCENE.bondWidth;
        context.setLineDash(HELIX_SCENE.bondDash);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      context.setLineDash([]);
      for (let index = 1; index < projected.length; index += 1) {
        const a = projected[index - 1];
        const b = projected[index];
        if (!a || !b) continue;
        const depth = (a.depth + b.depth) / 2;
        context.globalAlpha = 0.35 + 0.65 * depth;
        context.strokeStyle = colors.backbone;
        context.lineWidth = HELIX_SCENE.backboneWidth * (0.6 + 0.8 * depth);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      for (const atom of [...projected].sort((first, second) => first.depth - second.depth)) {
        const radius = HELIX_SCENE.atomRadius * (0.6 + 0.8 * atom.depth);
        context.globalAlpha = 0.5 + 0.5 * atom.depth;
        context.fillStyle = colors.atom;
        context.strokeStyle = colors.surface;
        context.lineWidth = HELIX_SCENE.atomStroke;
        context.beginPath();
        context.arc(atom.x, atom.y, radius, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
      }
      context.globalAlpha = 1;
      if (!reducedMotion.matches && visible) frame = requestAnimationFrame(draw);
    };

    const restart = () => { cancelAnimationFrame(frame); start = performance.now(); frame = requestAnimationFrame(draw); };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) restart();
      })
      : null;
    observer?.observe(element);
    if (!observer) restart();
    reducedMotion.addEventListener('change', restart);
    window.addEventListener('resize', restart);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      reducedMotion.removeEventListener('change', restart);
      window.removeEventListener('resize', restart);
    };
  }, [atoms, themeRevision]);

  return (
    <figure className="helix-scene">
      <canvas ref={canvas} className="helix-canvas" role="img" aria-label={t('landing.helixLabel')} />
      <figcaption className="helix-caption">
        {t('landing.helixCaption', {
          turn: formatNumber(360 / HELIX_GEOMETRY.degreesPerResidue, { maximumFractionDigits: 1 }),
          rise: formatNumber(HELIX_GEOMETRY.risePerResidueAngstrom, { minimumFractionDigits: 1 }),
          count: formatNumber(HELIX_GEOMETRY.residues),
        })}
      </figcaption>
    </figure>
  );
}
