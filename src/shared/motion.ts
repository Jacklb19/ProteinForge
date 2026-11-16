import { flushSync } from 'react-dom';
import { REDUCED_MOTION_QUERY } from '../features/structure/config';

/** Set on the document while a view transition runs, naming what changes so the style sheet animates only that. */
export const TRANSITION_ATTRIBUTE = 'data-transition';

/** What a view transition animates; the style sheet picks the animation by this name. */
export type TransitionKind = 'sidebar' | 'theme';

/**
 * Runs a visual change as a view transition where the browser supports it: the browser animates snapshots of
 * the page before and after, so nothing is laid out per frame. Without support, or with reduced motion, the
 * change simply happens.
 */
export function withViewTransition(kind: TransitionKind, update: () => void): void {
  if (typeof document.startViewTransition !== 'function' || window.matchMedia(REDUCED_MOTION_QUERY).matches) { update(); return; }
  const root = document.documentElement;
  root.setAttribute(TRANSITION_ATTRIBUTE, kind);
  const transition = document.startViewTransition(() => { flushSync(update); });
  void transition.finished.finally(() => { if (root.getAttribute(TRANSITION_ATTRIBUTE) === kind) root.removeAttribute(TRANSITION_ATTRIBUTE); });
}
