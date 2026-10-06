"""Regenerate matrix and alignment fixtures with pinned Biopython."""

import json
from pathlib import Path

import Bio
from Bio import Align
from Bio.Align import substitution_matrices


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "src" / "features" / "alignment" / "fixtures"
ALPHABET = "ACDEFGHIKLMNPQRSTVWYBZX"
MATRICES = ("BLOSUM45", "BLOSUM62", "BLOSUM80")
CASES = (
    ("internal_gap", "ACDEFGHIK", "ACDFGHIK", "global", "BLOSUM62"),
    ("free_ends", "GGACDEFGHKK", "ACDEFGH", "global", "BLOSUM62"),
    ("local", "PPACDEFGHKK", "GGACDEFGHTT", "local", "BLOSUM45"),
    ("ambiguous", "ACBZXDE", "ACBZXDE", "global", "BLOSUM80"),
)


def align(name, first, second, mode, matrix, free_ends=True):
    aligner = Align.PairwiseAligner()
    aligner.mode = mode
    aligner.substitution_matrix = substitution_matrices.load(matrix)
    aligner.open_gap_score = -10
    aligner.extend_gap_score = -0.5
    if mode == "global" and free_ends:
        # Biopython 1.87 supports these terminal-gap aliases.
        aligner.end_open_gap_score = 0
        aligner.end_extend_gap_score = 0
    alignment = aligner.align(first, second)[0]
    return {
        "name": name,
        "first": first,
        "second": second,
        "mode": mode,
        "matrix": matrix,
        "freeEnds": free_ends if mode == "global" else False,
        "score": alignment.score,
        "alignedFirst": alignment[0],
        "alignedSecond": alignment[1],
    }


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    matrices = {
        "source": "Biopython Bio.Align.substitution_matrices",
        "version": Bio.__version__,
        "alphabet": ALPHABET,
        "values": {
            name: [[int(substitution_matrices.load(name)[a, b]) for b in ALPHABET] for a in ALPHABET]
            for name in MATRICES
        },
    }
    (DESTINATION / "blosum.json").write_text(json.dumps(matrices, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cases = [align(*case) for case in CASES]
    free_ends_case = next(case for case in CASES if case[0] == "free_ends")
    cases.append(align(*free_ends_case, free_ends=False))
    (DESTINATION / "biopython.json").write_text(
        json.dumps({"version": Bio.__version__, "consultedAt": "2026-09-29", "cases": cases}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
