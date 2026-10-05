import { useEffect, useState } from 'react';

/** Invalidates canvas palettes when the explicit or system color scheme changes. */
export function useThemeRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => { setRevision((current) => current + 1); };
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    preference.addEventListener('change', refresh);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', refresh);
    };
  }, []);
  return revision;
}
