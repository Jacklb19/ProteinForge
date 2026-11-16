import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRANSITION_ATTRIBUTE, withViewTransition } from './motion';

function prefersReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'startViewTransition');
  document.documentElement.removeAttribute(TRANSITION_ATTRIBUTE);
});

describe('view transitions', () => {
  it('applies the change directly where the browser has no view transitions', () => {
    prefersReducedMotion(false);
    const update = vi.fn();
    withViewTransition('sidebar', update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('names the change on the document for the style sheet and clears it when the transition ends', async () => {
    prefersReducedMotion(false);
    let finish = (): void => undefined;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    const start = vi.fn((callback: () => void) => { callback(); return { finished }; });
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    const update = vi.fn(() => { expect(document.documentElement).toHaveAttribute(TRANSITION_ATTRIBUTE, 'theme'); });
    withViewTransition('theme', update);
    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    finish();
    await finished;
    await Promise.resolve();
    expect(document.documentElement).not.toHaveAttribute(TRANSITION_ATTRIBUTE);
  });

  it('skips the animation when reduced motion is asked for', () => {
    prefersReducedMotion(true);
    const start = vi.fn();
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    const update = vi.fn();
    withViewTransition('sidebar', update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
