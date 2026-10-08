import { useEffect, useRef } from 'react';

/** Marks a container as visible when it enters the viewport; CSS plays the entrance on `is-visible`. */
export function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const element = useRef<T>(null);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    if (typeof IntersectionObserver !== 'function') { target.classList.add('is-visible'); return; }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { target.classList.add('is-visible'); observer.disconnect(); }
      }
    }, { threshold: 0.15 });
    observer.observe(target);
    return () => { observer.disconnect(); };
  }, []);
  return element;
}
