const paths = {
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  sequence: 'M4 5h16M4 12h10M4 19h16M17 10l3 2-3 2',
  alignment: 'M4 6h16M4 18h16M7 9v6M12 9v6M17 9v6',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  contrast: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12l4 4 10-10',
  flask: 'M9 3h6M10 3v6L4 19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3M7 15h10',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  lock: 'M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.3-.9',
  logout: 'M10 4H5v16h5M14 8l5 4-5 4M19 12H9',
  chain: 'M7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9.5 11.5l5 2',
  wave: 'M3 12c3-6 6-6 9 0s6 6 9 0',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h8M8 11h8',
} as const;

export type IconName = keyof typeof paths;

/** Decorative action glyphs; visible labels provide the accessible name. */
export function Icon({ name }: { name: IconName }): React.JSX.Element {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[name]} /></svg>;
}
