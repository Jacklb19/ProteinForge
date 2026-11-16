import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import type { Expression } from 'molstar/lib/mol-script/language/expression';
import { Script } from 'molstar/lib/mol-script/script';
import { Bond, StructureElement, StructureProperties, StructureSelection } from 'molstar/lib/mol-model/structure';
import type { Structure } from 'molstar/lib/mol-model/structure';
import type { Loci } from 'molstar/lib/mol-model/loci';
import type { Location } from 'molstar/lib/mol-model/location';
import { ColorTheme } from 'molstar/lib/mol-theme/color';
import type { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { CHEMISTRY_THEME_NAME } from './config';

/** Residues of a single-chain model by their sequence positions. */
export function residuesExpression(positions: readonly number[]): Expression {
  return MS.struct.generator.atomGroups({ 'residue-test': MS.core.set.has([MS.set(...positions), MS.ammp('label_seq_id')]) });
}

export function lociOf(structure: Structure, expression: Expression): StructureElement.Loci {
  return StructureSelection.toLociWithSourceUnits(Script.getStructureSelection(expression, structure));
}

/** Sequence position of a picked residue, or null when the pick is empty or spans several residues. */
export function positionFromLoci(loci: Loci): number | null {
  if (!StructureElement.Loci.is(loci) || StructureElement.Loci.isEmpty(loci)) return null;
  const positions = new Set<number>();
  StructureElement.Loci.forEachLocation(loci, location => { positions.add(StructureProperties.residue.label_seq_id(location)); });
  const [position] = positions;
  return positions.size === 1 && position !== undefined && Number.isSafeInteger(position) && position > 0 ? position : null;
}

/** Residue colours read from the page; `byResidue` maps three-letter residue names to a colour. */
export interface ChemistryPalette {
  readonly byResidue: ReadonlyMap<string, Color>;
  readonly unclassified: Color;
}

/** `revision` only tells the viewer the palette changed, so the theme is built again with the new colours. */
const chemistryParams = { revision: PD.Numeric(0, {}, { isHidden: true }) };
type ChemistryParams = typeof chemistryParams;

/**
 * Colours every residue by the chemistry of its side chain, with the colours the rest of the application
 * uses for sequences. The palette is read each time the theme is built, so a new revision repaints the model.
 */
export function chemistryTheme(palette: () => ChemistryPalette): ColorTheme.Provider<ChemistryParams, typeof CHEMISTRY_THEME_NAME> {
  const factory: ColorTheme.Factory<ChemistryParams, 'group'> = (_context, props) => {
    const { byResidue, unclassified } = palette();
    const colorOf = (location: StructureElement.Location): Color => byResidue.get(StructureProperties.atom.label_comp_id(location)) ?? unclassified;
    const side = StructureElement.Location.create();
    const color = (location: Location): Color => {
      if (StructureElement.Location.is(location)) return colorOf(location);
      if (Bond.isLocation(location)) {
        const atom = location.aUnit.elements[location.aIndex];
        if (atom === undefined) return unclassified;
        side.structure = location.aStructure; side.unit = location.aUnit; side.element = atom;
        return colorOf(side);
      }
      return unclassified;
    };
    return { factory, granularity: 'group', color, props };
  };
  return {
    name: CHEMISTRY_THEME_NAME, label: CHEMISTRY_THEME_NAME, category: ColorTheme.Category.Residue,
    factory, getParams: () => chemistryParams, defaultValues: PD.getDefaultValues(chemistryParams), isApplicable: () => true,
  };
}
