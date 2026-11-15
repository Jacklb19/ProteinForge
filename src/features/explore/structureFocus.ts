import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import type { Expression } from 'molstar/lib/mol-script/language/expression';
import { Script } from 'molstar/lib/mol-script/script';
import { Bond, StructureElement, StructureProperties, StructureSelection } from 'molstar/lib/mol-model/structure';
import type { Structure } from 'molstar/lib/mol-model/structure';
import type { Loci } from 'molstar/lib/mol-model/loci';
import type { Location } from 'molstar/lib/mol-model/location';
import { ColorTheme } from 'molstar/lib/mol-theme/color';
import type { Color } from 'molstar/lib/mol-util/color';
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

/**
 * Colours every residue by the chemistry of its side chain, with the colours the rest of the application
 * uses for sequences. `byResidue` maps three-letter residue names to a colour.
 */
export function chemistryTheme(byResidue: ReadonlyMap<string, Color>, unclassified: Color): ColorTheme.Provider<Record<string, never>, typeof CHEMISTRY_THEME_NAME> {
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
  const factory: ColorTheme.Factory<Record<string, never>, 'group'> = (_context, props) => ({ factory, granularity: 'group', color, props });
  return {
    name: CHEMISTRY_THEME_NAME, label: CHEMISTRY_THEME_NAME, category: ColorTheme.Category.Residue,
    factory, getParams: () => ({}), defaultValues: {}, isApplicable: () => true,
  };
}
