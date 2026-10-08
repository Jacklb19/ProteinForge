/** Three residues joined by a bond form the mark; the same drawing is the application icon. */
export function BrandMark({ large = false }: { large?: boolean }): React.JSX.Element {
  return (
    <svg className={large ? 'brand-mark brand-mark-large' : 'brand-mark'} viewBox="0 0 32 32" aria-hidden="true">
      <path className="brand-bond" d="M8 22 L16 10 L24 22" />
      <circle className="brand-residue" cx="8" cy="22" r="4.5" />
      <circle className="brand-residue brand-residue-apex" cx="16" cy="10" r="4.5" />
      <circle className="brand-residue" cx="24" cy="22" r="4.5" />
    </svg>
  );
}
