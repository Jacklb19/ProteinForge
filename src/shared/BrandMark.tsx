import { DESIGN_ASSETS } from './designAssets';

/** Three residues joined by a bond form the approved application mark. */
export function BrandMark({ large = false }: { large?: boolean }): React.JSX.Element {
  return (
    <img className={large ? 'brand-mark brand-mark-large' : 'brand-mark'} src={DESIGN_ASSETS.brand} alt="" aria-hidden="true" />
  );
}
