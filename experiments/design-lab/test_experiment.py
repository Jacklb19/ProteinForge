"""Scientific file and comparison validation; synthetic coordinates only in tests."""

import math
import hashlib
from pathlib import Path
import tempfile
import unittest

import numpy as np

from experiment import compare_ca, package, parse_fasta, parse_pdb, read_json, sha256, write_json


def pdb(sequence="AGV", chain="A"):
    names = {"A": "ALA", "G": "GLY", "V": "VAL"}
    lines = []
    for residue, aa in enumerate(sequence, 1):
        for atom_index, atom in enumerate(("N", "CA", "C", "O")):
            serial = (residue - 1) * 4 + atom_index + 1
            x, y, z = float(residue), float(atom_index), float(residue * residue)
            lines.append(f"ATOM  {serial:5d} {atom:^4s} {names[aa]:3s} {chain}{residue:4d}    {x:8.3f}{y:8.3f}{z:8.3f}{1:6.2f}{80:6.2f}           C")
    return "\n".join(lines) + "\nEND\n"


class ValidationTests(unittest.TestCase):
    def test_exact_chain_and_residue_correspondence(self):
        parsed = parse_pdb(pdb(), "A", "AGV")
        self.assertEqual(parsed["residueKeys"], [[1, ""], [2, ""], [3, ""]])
        self.assertEqual(parsed["atomCount"], 12)
        with self.assertRaisesRegex(ValueError, "sequence"):
            parse_pdb(pdb(), "A", "AAA")
        with self.assertRaisesRegex(ValueError, "absent"):
            parse_pdb(pdb(), "B")

    def test_incomplete_backbone_rejected(self):
        lines = [line for line in pdb().splitlines() if line[12:16].strip() != "O"]
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            parse_pdb("\n".join(lines), "A")

    def test_nonfinite_atom_rejected(self):
        text = pdb()
        malformed = text[:30] + "     nan" + text[38:]
        with self.assertRaisesRegex(ValueError, "Non-finite"):
            parse_pdb(malformed, "A")

    def test_duplicate_atom_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            parse_pdb(pdb().splitlines()[0] + "\n" + pdb(), "A")

    def test_fasta_rejects_empty_multichain_and_unknown(self):
        self.assertEqual(parse_fasta(">public\nAG\nV\n")[0]["sequence"], "AGV")
        for text in (">empty\n", ">two chains\nAG/V\n", ">unknown\nAGX\n", "AGV"):
            with self.assertRaises(ValueError):
                parse_fasta(text)

    def test_rigid_transform_is_removed(self):
        reference = np.array([[0, 0, 0], [1, 0, 0], [0, 2, 0], [0, 0, 3]], dtype=float)
        rotation = np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]])
        prediction = reference @ rotation + [5, 8, -3]
        result = compare_ca(reference, prediction)
        self.assertLess(result["caRmsdAngstrom"], 1e-12)
        self.assertAlmostEqual(np.linalg.det(result["rotationRowVectors"]), 1)

    def test_reflection_is_not_accepted_as_a_rotation(self):
        reference = np.array([[0, 0, 0], [1, 0, 0], [0, 2, 0], [0, 0, 3]], dtype=float)
        result = compare_ca(reference, reference * [-1, 1, 1])
        self.assertGreater(result["caRmsdAngstrom"], 0.5)

    def test_bad_comparison_coordinates_rejected(self):
        for reference, prediction in (([[0, 0, 0]], [[0, 0, 0]]),
                                      ([[0, 0, 0]] * 3, [[0, 0, 0]] * 4),
                                      ([[math.inf, 0, 0]] * 3, [[0, 0, 0]] * 3)):
            with self.assertRaises(ValueError):
                compare_ca(reference, prediction)

    def test_incomplete_bundle_remains_incomplete_and_excludes_downloads(self):
        import zipfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "run"
            root.mkdir()
            write_json(root / "config.json", {"seed": 42})
            (root / "downloads").mkdir()
            (root / "downloads" / "weights.bin").write_bytes(b"not a model; synthetic test")
            package(root, {"schemaVersion": 1, "limitations": ["synthetic unit test"]})
            self.assertEqual(read_json(root / "validation.json")["status"], "incomplete")
            with zipfile.ZipFile(root.parent / "proteinforge-design-lab-results.zip") as bundle:
                self.assertFalse(any("downloads/" in name for name in bundle.namelist()))
                self.assertIn("result-manifest.json", bundle.namelist())
            self.assertEqual(len(sha256(root / "config.json")), 64)

    def test_complete_bundle_checks_exact_sequence_provenance(self):
        config = {"schemaVersion": 1, "limitations": ["synthetic unit test"],
                  "reference": {"chain": "A", "sequence": "AGV"}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "run"
            root.mkdir()
            for name in ("environment.json", "reference.json"):
                write_json(root / name, {"testOnly": True})
            digest = hashlib.sha256(b"AGV").hexdigest()
            write_json(root / "candidate.json", {"sequence": "AGV", "sequenceSha256": digest})
            write_json(root / "prediction.json", {"sequence": "AGV", "sequenceSha256": digest})
            write_json(root / "design-summary.json", {"repeatSequencesEqual": True})
            (root / "reference.pdb").write_text(pdb())
            (root / "prediction.pdb").write_text(pdb())
            package(root, config)
            self.assertEqual(read_json(root / "validation.json")["status"], "completed")
            self.assertLess(read_json(root / "comparison.json")["caRmsdAngstrom"], 1e-12)
            write_json(root / "prediction.json", {"sequence": "AAA", "sequenceSha256": digest})
            with self.assertRaisesRegex(ValueError, "provenance"):
                package(root, config)
            self.assertEqual(read_json(root / "validation.json")["status"], "incomplete")


if __name__ == "__main__":
    unittest.main()
