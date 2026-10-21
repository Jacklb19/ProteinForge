import { ensure, LAB_CONFIG as C, required } from './config';
import type { Coordinates, LabResidueKey } from './types';
export const THREE_TO_ONE: Readonly<Record<string, string>> = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
    LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
};
export interface ParsedPdb {
    sequence: string;
    keys: LabResidueKey[];
    ca: Coordinates[];
    caConfidence: number[];
    atomCount: number;
}
function field(text: string): number {
    ensure(text.trim() !== '', 'pdb');
    const value = Number(text);
    ensure(Number.isFinite(value), 'pdb');
    return value;
}
/** One explicit chain in the first model, with insertion codes retained instead of inferred sequence offsets. */
export function parsePdb(text: string, chain: string, sequence: string): ParsedPdb {
    const residues: {
        key: LabResidueKey;
        name: string;
        atoms: Map<string, Coordinates>;
        confidence: number;
    }[] = [];
    let atomCount = 0;
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('ENDMDL') || line.trim() === 'END')
            break;
        if (!line.startsWith('ATOM  '))
            continue;
        ensure(line.length >= 66 && line[21] === chain && (line[16] === ' ' || line[16] === 'A'), 'pdb');
        const number = field(line.slice(22, 26)), insertion = line.slice(26, 27).trim();
        ensure(Number.isInteger(number) && /^[A-Za-z]?$/.test(insertion), 'pdb');
        const name = line.slice(17, 20), atom = line.slice(12, 16).trim();
        ensure(THREE_TO_ONE[name] && field(line.slice(54, 60)) > 0, 'pdb');
        const point: Coordinates = [field(line.slice(30, 38)), field(line.slice(38, 46)), field(line.slice(46, 54))];
        ensure(point.every(value => Math.abs(value) < 100000), 'pdb');
        let residue = residues.at(-1);
        if (!residue || residue.key.number !== number || residue.key.insertion !== insertion) {
            ensure(!residue || number > residue.key.number || (number === residue.key.number && insertion > residue.key.insertion), 'pdb');
            residue = { key: { chain, number, insertion }, name, atoms: new Map(), confidence: 0 };
            residues.push(residue);
            ensure(residues.length <= C.maximumResidues, 'size');
        }
        ensure(residue.name === name && atom.length > 0 && !residue.atoms.has(atom), 'pdb');
        residue.atoms.set(atom, point);
        atomCount++;
        if (atom === 'CA')
            residue.confidence = field(line.slice(60, 66));
    }
    ensure(residues.length === sequence.length && residues.map(residue => THREE_TO_ONE[residue.name]).join('') === sequence, 'sequence');
    ensure(residues.every(residue => ['N', 'CA', 'C', 'O'].every(atom => residue.atoms.has(atom))), 'pdb');
    return { sequence, keys: residues.map(residue => residue.key), ca: residues.map(residue => required(residue.atoms.get('CA'))), caConfidence: residues.map(residue => residue.confidence), atomCount };
}
export function parseFasta(text: string): string[] {
    const sequences: string[] = [];
    for (const line of text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
        if (line.startsWith('>')) {
            ensure(line.length <= 1024 && sequences.length < C.maximumVariants + 1, 'sequence');
            sequences.push('');
        }
        else {
            ensure(sequences.length > 0 && /^[ACDEFGHIKLMNPQRSTVWY]+$/.test(line), 'sequence');
            const previous = required(sequences[sequences.length - 1]);
            ensure(previous.length + line.length <= C.maximumResidues, 'sequence');
            sequences[sequences.length - 1] = previous + line;
        }
    }
    ensure(sequences.length > 0 && sequences.length <= C.maximumVariants + 1 && sequences.every(value => value.length > 0 && value.length <= C.maximumResidues), 'sequence');
    return sequences;
}
/** Horn's proper quaternion rotation, with a Jacobi eigensolve (not a reflection or outlier-filtered fit). */
export function superpose(reference: number[][], prediction: number[][]): {
    aligned: Coordinates[];
    rmsd: number;
} {
    ensure(reference.length >= 3 && reference.length === prediction.length && reference.length <= C.maximumResidues, 'comparison');
    ensure([...reference, ...prediction].every(point => point.length === 3 && point.every(Number.isFinite)), 'comparison');
    const center = (points: number[][]): Coordinates => [0, 1, 2].map(axis => points.reduce((sum, point) => sum + required(point[axis]), 0) / points.length) as Coordinates;
    const a = center(reference), b = center(prediction);
    const s = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (let index = 0; index < prediction.length; index++)
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++) {
                const target = required(s[row]);
                target[col] = required(target[col]) + (required(required(prediction[index])[row]) - required(b[row])) * (required(required(reference[index])[col]) - required(a[col]));
            }
    const xx = required(required(s[0])[0]), xy = required(required(s[0])[1]), xz = required(required(s[0])[2]), yx = required(required(s[1])[0]), yy = required(required(s[1])[1]), yz = required(required(s[1])[2]), zx = required(required(s[2])[0]), zy = required(required(s[2])[1]), zz = required(required(s[2])[2]);
    const matrix = [[xx + yy + zz, yz - zy, zx - xz, xy - yx], [yz - zy, xx - yy - zz, xy + yx, zx + xz], [zx - xz, xy + yx, -xx + yy - zz, yz + zy], [xy - yx, zx + xz, yz + zy, -xx - yy + zz]];
    const vectors: number[][] = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i === j ? 1 : 0));
    for (let sweep = 0; sweep < 80; sweep++) {
        let p = 0, q = 1;
        for (let i = 0; i < 4; i++)
            for (let j = i + 1; j < 4; j++)
                if (Math.abs(required(required(matrix[i])[j])) > Math.abs(required(required(matrix[p])[q]))) {
                    p = i;
                    q = j;
                }
        if (Math.abs(required(required(matrix[p])[q])) < 1e-12)
            break;
        const angle = .5 * Math.atan2(2 * required(required(matrix[p])[q]), required(required(matrix[q])[q]) - required(required(matrix[p])[p]));
        const cosine = Math.cos(angle), sine = Math.sin(angle);
        const pp = required(required(matrix[p])[p]), qq = required(required(matrix[q])[q]), pq = required(required(matrix[p])[q]);
        for (let k = 0; k < 4; k++)
            if (k !== p && k !== q) {
                const kp = required(required(matrix[k])[p]), kq = required(required(matrix[k])[q]);
                required(matrix[k])[p] = required(matrix[p])[k] = cosine * kp - sine * kq;
                required(matrix[k])[q] = required(matrix[q])[k] = sine * kp + cosine * kq;
            }
        required(matrix[p])[p] = cosine * cosine * pp - 2 * sine * cosine * pq + sine * sine * qq;
        required(matrix[q])[q] = sine * sine * pp + 2 * sine * cosine * pq + cosine * cosine * qq;
        required(matrix[p])[q] = required(matrix[q])[p] = 0;
        for (let k = 0; k < 4; k++) {
            const kp = required(required(vectors[k])[p]), kq = required(required(vectors[k])[q]);
            required(vectors[k])[p] = cosine * kp - sine * kq;
            required(vectors[k])[q] = sine * kp + cosine * kq;
        }
    }
    let best = 0;
    for (let i = 1; i < 4; i++)
        if (required(required(matrix[i])[i]) > required(required(matrix[best])[best]))
            best = i;
    const [w, x, y, z] = vectors.map(row => required(row[best])) as [
        number,
        number,
        number,
        number
    ];
    const r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
    const aligned = prediction.map(point => r.map((row, axis) => row.reduce((sum, value, j) => sum + value * (required(point[j]) - required(b[j])), 0) + required(a[axis])) as Coordinates);
    const rmsd = Math.sqrt(aligned.reduce((sum, point, i) => sum + point.reduce((subtotal, value, j) => subtotal + (value - required(required(reference[i])[j])) ** 2, 0), 0) / aligned.length);
    ensure(Number.isFinite(rmsd), 'comparison');
    return { aligned, rmsd };
}
