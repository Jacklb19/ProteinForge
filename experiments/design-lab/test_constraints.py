"""Constraint contracts and command wiring; no Torch, GPU or biological inference."""

from contextlib import nullcontext
import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

from constraints import load_draft, prepare_constraints, verify_constraints
from experiment import design, package, parse_pdb, read_json, write_json
from test_experiment import pdb
from build_notebook import build, demo_draft, DESTINATION


class ConstraintTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / "run"
        self.root.mkdir()
        self.reference = parse_pdb(pdb(), "A", "AGV")
        self.config = {"reference": {"id": "TEST", "chain": "A", "sequence": "AGV"},
                       "design": {"seed": 42, "samples": 1, "selectedSample": 1, "model": "v_48_020",
                                  "temperature": .1, "maxLength": 120}, "measurement": {"sampleSeconds": .5}}
        keys = [{"chain": "A", "number": number, "insertion": ""} for number in (1, 2, 3)]
        self.draft = {"kind": "proteinforge-design-draft", "schemaVersion": 2, "sequence": "AVV",
                      "source": {"referenceId": "TEST", "referenceChain": "A", "referenceSequence": "AGV",
                                 "variantSequence": "AGV", "variantSequenceSha256": hashlib.sha256(b"AGV").hexdigest(),
                                 "sample": 1, "variantKeys": keys},
                      "structureStatus": "requires-new-prediction", "constraintStatus": "not-executed",
                      "protectedPositions": [{"chainPosition": 2, "residue": "V", "referenceKey": keys[1], "predictionKey": keys[1]}]}

    def record(self, draft=None):
        write_json(self.root / "design-draft.json", self.draft if draft is None else draft)
        digest = hashlib.sha256((self.root / "design-draft.json").read_bytes()).hexdigest()
        self.config["design"]["constraints"] = {"draftSha256": digest}
        return digest

    def test_seed_uses_the_edited_residue_without_rewriting_experimental_coordinates(self):
        self.record()
        before = copy.deepcopy(self.reference)
        draft = prepare_constraints(self.root, self.config, self.reference)
        record = read_json(self.root / "design-input.jsonl")
        self.assertEqual(record["seq_chain_A"], "AVV")
        self.assertEqual(record["coords_chain_A"]["CA_chain_A"], self.reference["ca"])
        self.assertEqual(read_json(self.root / "fixed-positions.jsonl"), {"reference": {"A": [2]}})
        self.assertEqual(self.reference, before)
        verify_constraints(draft, [{"sequence": "GVV"}])  # Unprotected residues may change.
        with self.assertRaisesRegex(ValueError, "protected position"):
            verify_constraints(draft, [{"sequence": "AGV"}])

    def test_changed_hash_and_derived_inputs_are_rejected(self):
        self.record()
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            load_draft(self.root / "design-draft.json", self.config["reference"], self.reference, "0" * 64)
        prepare_constraints(self.root, self.config, self.reference)
        (self.root / "fixed-positions.jsonl").write_text('{}\n')
        with self.assertRaisesRegex(ValueError, "input changed"):
            prepare_constraints(self.root, self.config, self.reference)

    def test_ambiguous_mapping_source_or_status_never_reaches_generation(self):
        variants = []
        for field, value in (("schemaVersion", 1), ("sequence", "AXV"), ("constraintStatus", "executed"),
                             ("structureStatus", "associated-result"), ("protectedPositions", [])):
            draft = copy.deepcopy(self.draft); draft[field] = value; variants.append(draft)
        for position in (0, 4, True):
            draft = copy.deepcopy(self.draft); draft["protectedPositions"][0]["chainPosition"] = position; variants.append(draft)
        draft = copy.deepcopy(self.draft); draft["protectedPositions"] *= 2; variants.append(draft)
        draft = copy.deepcopy(self.draft); draft["source"]["variantSequenceSha256"] = "0" * 64; variants.append(draft)
        draft = copy.deepcopy(self.draft); draft["protectedPositions"][0]["referenceKey"]["number"] = 99; variants.append(draft)
        for draft in variants:
            with self.subTest(draft=draft):
                digest = self.record(draft)
                with self.assertRaises(ValueError):
                    load_draft(self.root / "design-draft.json", self.config["reference"], self.reference, digest)

    def test_undeclared_draft_is_not_silently_ignored(self):
        (self.root / "design-draft.json").write_text('{}')
        with self.assertRaisesRegex(ValueError, "without a declared"):
            prepare_constraints(self.root, self.config, self.reference)

    def run_design(self, candidate):
        self.record()
        (self.root / "reference.pdb").write_text(self.reference["pdb"])
        write_json(self.root / "reference.json", {key: value for key, value in self.reference.items() if key != "pdb"})
        commands = []
        def generated(command, **_):
            commands.append(command)
            destination = Path(command[command.index("--out_folder") + 1]) / "seqs"
            destination.mkdir(parents=True)
            (destination / "reference.fa").write_text(f">seed\nAVV\n>sample\n{candidate}\n")
            return SimpleNamespace(stdout="synthetic test", check_returncode=lambda: None)
        with patch("experiment.measurement", return_value=nullcontext()), patch("experiment.subprocess.run", side_effect=generated):
            design(self.root, self.config)
        return commands

    def test_both_design_commands_execute_fixed_position_input_and_check_output(self):
        commands = self.run_design("AVV")
        self.assertEqual(len(commands), 2)
        for command in commands:
            self.assertIn("--jsonl_path", command)
            self.assertIn("--fixed_positions_jsonl", command)
            self.assertNotIn("--pdb_path", command)
        self.assertEqual(read_json(self.root / "constraints-validation.json")["status"], "executed")

    def test_failed_generation_leaves_no_successful_constraint_report(self):
        with self.assertRaisesRegex(ValueError, "protected position"):
            self.run_design("AGV")
        self.assertEqual(read_json(self.root / "constraints-validation.json")["status"], "incomplete")
        self.assertFalse((self.root / "candidate.json").exists())

    def test_packaging_rechecks_constraints_and_invalidates_stale_success(self):
        self.run_design("AVV")
        self.config.update(schemaVersion=1, limitations=["synthetic test only"])
        write_json(self.root / "environment.json", {"syntheticTest": True})
        candidate = read_json(self.root / "candidate.json")
        write_json(self.root / "prediction.json", {"sequence": candidate["sequence"], "sequenceSha256": candidate["sequenceSha256"]})
        (self.root / "prediction.pdb").write_text(pdb("AVV"))
        package(self.root, self.config)
        self.assertEqual(read_json(self.root / "validation.json")["status"], "completed")
        report = read_json(self.root / "constraints-validation.json")
        report["allProtectedPositionsPreserved"] = False
        write_json(self.root / "constraints-validation.json", report)
        with self.assertRaisesRegex(ValueError, "execution report"):
            package(self.root, self.config)
        self.assertEqual(read_json(self.root / "validation.json")["status"], "incomplete")

    def test_notebook_is_deterministic_output_free_and_demo_is_explicit(self):
        build(); first = DESTINATION.read_bytes(); build(); self.assertEqual(DESTINATION.read_bytes(), first)
        notebook = json.loads(first)
        code = [cell for cell in notebook["cells"] if cell["cell_type"] == "code"]
        self.assertTrue(all(cell["outputs"] == [] and cell["execution_count"] is None for cell in code))
        self.assertIn('DRAFT_MODE = "none"', ''.join(next(cell for cell in code if cell["id"] == "constraints")["source"]))
        demo = demo_draft(); self.assertEqual(demo["sequence"][1], "R")
        self.assertEqual([entry["chainPosition"] for entry in demo["protectedPositions"]], [2, 7, 42])


if __name__ == "__main__":
    unittest.main()
