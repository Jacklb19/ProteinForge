import { describe, expect, it } from 'vitest';
import { NullLocation } from 'molstar/lib/mol-model/location';
import type { ThemeDataContext } from 'molstar/lib/mol-theme/theme';
import { Color } from 'molstar/lib/mol-util/color';
import { chemistryTheme } from './structureFocus';
import type { ChemistryPalette } from './structureFocus';

const context: ThemeDataContext = {};

describe('chemistry colour theme', () => {
  it('reads the palette each time it is built, so a new revision repaints with the current colours', () => {
    let palette: ChemistryPalette = { byResidue: new Map([['ALA', Color(0x111111)]]), unclassified: Color(0x222222) };
    const provider = chemistryTheme(() => palette);
    expect(provider.defaultValues).toEqual({ revision: 0 });
    expect(provider.getParams(context).revision.isHidden).toBe(true);
    const colourOf = (revision: number): Color => {
      const theme = provider.factory(context, { revision });
      if (!('color' in theme)) throw new Error('The chemistry theme colours locations.');
      return theme.color(NullLocation, false);
    };

    expect(colourOf(0)).toBe(Color(0x222222));
    palette = { byResidue: new Map([['ALA', Color(0x333333)]]), unclassified: Color(0x444444) };
    expect(colourOf(1)).toBe(Color(0x444444));
  });
});
