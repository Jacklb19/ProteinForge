// Extracts the Cα trace and cysteine Sγ atoms of insulin (PDB 1TRZ, chains A and B) from the
// unmodified BinaryCIF fixture. Run with `node scripts/build-backbone.mjs` to regenerate the JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CIF } = require('molstar/lib/commonjs/mol-io/reader/cif');

const SOURCE = 'e2e/fixtures/1TRZ.bcif';
const TARGET = 'src/features/structure/fixtures/1trz-backbone.json';
const CHAINS = ['A', 'B'];
const KEPT_ATOMS = ['CA', 'SG'];
const PRIMARY_ALTERNATE = 'A';
const DECIMALS = 100;

const parsed = await CIF.parseBinary(new Uint8Array(readFileSync(SOURCE))).run();
if (parsed.isError) throw new Error(`Could not parse ${SOURCE}`);
const site = parsed.result.blocks[0].categories.atom_site;
const field = (name) => site.getField(name);
const group = field('group_PDB');
const atom = field('label_atom_id');
const component = field('label_comp_id');
const chain = field('auth_asym_id');
const number = field('auth_seq_id');
const alternate = field('label_alt_id');
const coordinates = ['Cartn_x', 'Cartn_y', 'Cartn_z'].map(field);

const chains = CHAINS.map((id) => ({ id, residues: [] }));
for (let row = 0; row < site.rowCount; row += 1) {
  if (group.str(row) !== 'ATOM' || !KEPT_ATOMS.includes(atom.str(row))) continue;
  const target = chains.find((entry) => entry.id === chain.str(row));
  const alternateId = alternate.str(row);
  if (!target || (alternateId && alternateId !== PRIMARY_ALTERNATE)) continue;
  const position = number.int(row);
  let residue = target.residues.find((entry) => entry.number === position);
  if (!residue) { residue = { number: position, name: component.str(row) }; target.residues.push(residue); }
  residue[atom.str(row) === 'CA' ? 'ca' : 'sg'] = coordinates.map((axis) => Math.round(axis.float(row) * DECIMALS) / DECIMALS);
}
for (const entry of chains) entry.residues.sort((first, second) => first.number - second.number);

writeFileSync(TARGET, `${JSON.stringify({ id: '1TRZ', source: 'https://models.rcsb.org/1trz.bcif', method: 'X-ray diffraction', resolution: 1.6, chains })}\n`);
console.log(chains.map((entry) => `${entry.id}: ${entry.residues.length} residues`).join(', '));
