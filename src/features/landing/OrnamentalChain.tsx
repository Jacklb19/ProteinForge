import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { DESIGN_ASSETS } from '../../shared/designAssets';
import { ORNAMENT_POINTER_TILT_DEGREES } from './config';

/** The approved illustration is ornamental. CSS gives it a gentle turn, never a scientific trajectory. */
export function OrnamentalChain(): React.JSX.Element {
  const { t } = useTranslation();
  const figure = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = figure.current;
    if (!element) return;
    let visible = false;
    const sync = () => { element.dataset.motionActive = String(visible && !document.hidden); };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); sync(); })
      : null;
    if (observer) observer.observe(element);
    else { visible = true; sync(); }
    document.addEventListener('visibilitychange', sync);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  function tilt(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    const horizontal = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    element.style.setProperty('--pointer-turn', `${String(horizontal * ORNAMENT_POINTER_TILT_DEGREES)}deg`);
    element.style.setProperty('--pointer-tilt', `${String(-vertical * ORNAMENT_POINTER_TILT_DEGREES)}deg`);
  }

  function resetTilt(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.style.removeProperty('--pointer-turn');
    event.currentTarget.style.removeProperty('--pointer-tilt');
  }

  return (
    <div className="ornamental-scene" ref={figure} data-motion-active="false" onPointerMove={tilt} onPointerLeave={resetTilt}>
      <img className="ornamental-chain" src={DESIGN_ASSETS.ornament} alt={t('landing.ornamentLabel')} fetchPriority="high" />
    </div>
  );
}
