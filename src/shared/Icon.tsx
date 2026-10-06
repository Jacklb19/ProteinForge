type IconName = 'sequence' | 'alignment' | 'settings' | 'upload';

const paths: Record<IconName, string> = {
  sequence: 'M4 5h16M4 12h10M4 19h16M17 10l3 2-3 2',
  alignment: 'M4 6h16M4 18h16M7 9v6M12 9v6M17 9v6',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
};

/** Decorative action glyphs; visible labels provide the accessible name. */
export function Icon({ name }: { name: IconName }): React.JSX.Element {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[name]} /></svg>;
}
