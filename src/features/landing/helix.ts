/** Ideal α-helix parameters (Pauling–Corey); the drawing is reference geometry, not a solved structure. */
export interface HelixGeometry {
  residues: number;
  radiusAngstrom: number;
  risePerResidueAngstrom: number;
  degreesPerResidue: number;
  /** Residue offset of the backbone hydrogen bond, i → i + 4 in an α-helix. */
  hydrogenBondOffset: number;
}

export interface Point3 { x: number; y: number; z: number }

export interface ProjectedAtom {
  index: number;
  x: number;
  y: number;
  /** 0 (farthest) to 1 (nearest), for size and opacity. */
  depth: number;
}

/** Cα positions of an ideal helix centered on the origin, axis along Y. */
export function helixAtoms(geometry: HelixGeometry): Point3[] {
  const total = (geometry.residues - 1) * geometry.risePerResidueAngstrom;
  return Array.from({ length: geometry.residues }, (_, index) => {
    const angle = (index * geometry.degreesPerResidue * Math.PI) / 180;
    return {
      x: geometry.radiusAngstrom * Math.cos(angle),
      y: index * geometry.risePerResidueAngstrom - total / 2,
      z: geometry.radiusAngstrom * Math.sin(angle),
    };
  });
}

/**
 * Rotates about the vertical axis, tilts toward the viewer and projects with a simple perspective.
 * `perspective` is the viewer distance in ångström, so it stays valid whatever the pixel scale.
 */
export function projectAtoms(atoms: Point3[], options: { rotation: number; tilt: number; scale: number; width: number; height: number; perspective: number }): ProjectedAtom[] {
  const cosR = Math.cos(options.rotation);
  const sinR = Math.sin(options.rotation);
  const cosT = Math.cos(options.tilt);
  const sinT = Math.sin(options.tilt);
  const rotated = atoms.map((atom) => {
    const x = atom.x * cosR - atom.z * sinR;
    const z = atom.x * sinR + atom.z * cosR;
    const y = atom.y * cosT - z * sinT;
    return { x, y, z: atom.y * sinT + z * cosT };
  });
  const zs = rotated.map((atom) => atom.z);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return rotated.map((atom, index) => {
    const factor = options.perspective / Math.max(1, options.perspective - atom.z);
    return {
      index,
      x: options.width / 2 + atom.x * options.scale * factor,
      y: options.height / 2 - atom.y * options.scale * factor,
      depth: maxZ === minZ ? 1 : (atom.z - minZ) / (maxZ - minZ),
    };
  });
}
