const paths = {
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.3-.9',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  analyze: 'M4 18V6m0 12h16M8 14l3-4 4 3 5-8',
  compare: 'M4 7h16M4 17h16m-4-14 4 4-4 4M8 13l-4 4 4 4',
  design: 'm15 3 6 6M4 20l3-7L17 3l4 4L11 17l-7 3ZM7 13l4 4',
  laboratory: 'M8 3h8M10 3v7L4 20h16l-6-10V3M8 15h8',
  library: 'M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4V4Zm8 2v16',
  projects: 'M3 6h7l2 3h9v11H3V6Z',
  help: 'M12 17v.1M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  collapse: 'M4 4h16v16H4V4ZM9 4v16m8-12-4 4 4 4',
  expand: 'M4 4h16v16H4V4ZM9 4v16m4-12 4 4-4 4',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-3a8 8 0 0 1 16 0v3',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c-5 5-5 15 0 20 5-5 5-15 0-20Z',
} as const;

export type IconName = keyof typeof paths;

/** Decorative action glyphs; visible labels provide the accessible name. */
export function Icon({ name }: { name: IconName }): React.JSX.Element {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[name]} /></svg>;
}
