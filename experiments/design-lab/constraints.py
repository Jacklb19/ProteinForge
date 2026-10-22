"""Validate laboratory draft v2 and prepare explicit ProteinMPNN fixed-position input."""

import hashlib
import json
from pathlib import Path
import re

MAX_DRAFT_BYTES = 65_536
MAX_RESIDUES = 120
AMINO_ACIDS = re.compile(r"[ACDEFGHIKLMNPQRSTVWY]{3,120}\Z")
HASH = re.compile(r"[a-f0-9]{64}\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_draft(path, reference_config, reference, expected_hash):
    require(path.stat().st_size <= MAX_DRAFT_BYTES, "Draft exceeds the size limit")
    raw = path.read_bytes()
    require(HASH.fullmatch(expected_hash) and hashlib.sha256(raw).hexdigest() == expected_hash,
            "Draft SHA-256 mismatch")
    draft = json.loads(raw)
    require(isinstance(draft, dict) and draft.get("kind") == "proteinforge-design-draft"
            and type(draft.get("schemaVersion")) is int and draft["schemaVersion"] == 2,
            "Re-export the draft as laboratory draft v2")
    sequence = draft.get("sequence")
    require(isinstance(sequence, str) and AMINO_ACIDS.fullmatch(sequence)
            and len(sequence) == len(reference["sequence"]), "Draft sequence mismatch")
    source = draft.get("source", {})
    require(isinstance(source, dict) and source.get("referenceId") == reference_config["id"]
            and source.get("referenceChain") == reference_config["chain"]
            and source.get("referenceSequence") == reference["sequence"], "Draft reference mismatch")
    original = source.get("variantSequence")
    require(isinstance(original, str) and AMINO_ACIDS.fullmatch(original)
            and len(original) == len(sequence)
            and hashlib.sha256(original.encode("ascii")).hexdigest() == source.get("variantSequenceSha256"),
            "Draft source sequence hash mismatch")
    require(type(source.get("sample")) is int and 1 <= source["sample"] <= 3, "Draft source sample mismatch")
    keys = source.get("variantKeys")
    require(isinstance(keys, list) and len(keys) == len(sequence), "Draft prediction keys mismatch")
    seen_keys = set()
    for key in keys:
        require(isinstance(key, dict) and isinstance(key.get("chain"), str)
                and re.fullmatch(r"[A-Za-z0-9]", key["chain"])
                and type(key.get("number")) is int and isinstance(key.get("insertion"), str)
                and re.fullmatch(r"[A-Za-z]?", key["insertion"]), "Draft prediction key is invalid")
        identity = (key["chain"], key["number"], key["insertion"])
        require(identity not in seen_keys, "Duplicate draft prediction key")
        seen_keys.add(identity)
    expected_status = "associated-result" if sequence == original else "requires-new-prediction"
    require(draft.get("constraintStatus") == "not-executed" and draft.get("structureStatus") == expected_status,
            "Draft execution status mismatch")
    positions = draft.get("protectedPositions")
    require(isinstance(positions, list) and 0 < len(positions) < len(sequence),
            "Protect at least one position and leave at least one position for redesign")
    seen = set()
    for entry in positions:
        require(isinstance(entry, dict) and type(entry.get("chainPosition")) is int,
                "Invalid protected chain position")
        position = entry["chainPosition"]
        require(1 <= position <= len(sequence) and position not in seen, "Duplicate or out-of-range protected position")
        seen.add(position)
        number, insertion = reference["residueKeys"][position - 1]
        require(entry.get("residue") == sequence[position - 1]
                and entry.get("referenceKey") == {"chain": reference_config["chain"], "number": number, "insertion": insertion}
                and entry.get("predictionKey") == keys[position - 1], "Protected residue mapping mismatch")
    return draft


def prepare_constraints(root, config, reference):
    settings = config.get("design", {}).get("constraints")
    if settings is None:
        require(not any((root / name).exists() for name in ("design-draft.json", "design-input.jsonl", "fixed-positions.jsonl", "constraints-validation.json")),
                "Draft exists without a declared constraint configuration")
        return None
    require(isinstance(settings, dict) and set(settings) == {"draftSha256"}, "Invalid constraints configuration")
    draft = load_draft(root / "design-draft.json", config["reference"], reference, settings["draftSha256"])
    # JSONL keeps measured backbone atoms and supplies the draft sequence separately.
    # No experimental PDB residue names or absent side-chain atoms are rewritten.
    chain = reference["chain"]
    coordinates = {atom: [] for atom in ("N", "CA", "C", "O")}
    for line in reference["pdb"].splitlines():
        atom = line[12:16].strip()
        if line.startswith("ATOM  ") and atom in coordinates:
            coordinates[atom].append([float(line[a:b]) for a, b in ((30, 38), (38, 46), (46, 54))])
    require(all(len(values) == len(draft["sequence"]) for values in coordinates.values()), "Backbone input length mismatch")
    record = {"name": "reference", "num_of_chains": 1, "seq": draft["sequence"],
              f"seq_chain_{chain}": draft["sequence"],
              f"coords_chain_{chain}": {f"{atom}_chain_{chain}": values for atom, values in coordinates.items()}}
    positions = sorted(entry["chainPosition"] for entry in draft["protectedPositions"])
    fixed = {"reference": {chain: positions}}
    for filename, value in (("design-input.jsonl", record), ("fixed-positions.jsonl", fixed)):
        path = root / filename
        payload = json.dumps(value, separators=(",", ":")) + "\n"
        if path.exists():
            require(path.read_text() == payload, "Derived constraint input changed")
        else:
            path.write_text(payload, encoding="ascii")
    return draft


def verify_constraints(draft, candidates):
    for candidate in candidates:
        sequence = candidate["sequence"]
        require(len(sequence) == len(draft["sequence"]), "Constrained candidate length mismatch")
        for entry in draft["protectedPositions"]:
            require(sequence[entry["chainPosition"] - 1] == entry["residue"],
                    "Generated sequence violates a protected position")


def constraint_report(draft, config):
    return {"status": "executed", "draftSha256": config["design"]["constraints"]["draftSha256"],
            "seedSequence": draft["sequence"], "protectedPositions": draft["protectedPositions"],
            "samplesCheckedPerRun": config["design"]["samples"], "runsChecked": 2,
            "allProtectedPositionsPreserved": True}
