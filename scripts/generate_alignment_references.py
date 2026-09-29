"""Regenera matrices y casos de referencia con Biopython fijado en requirements-reference.txt."""

import json
from pathlib import Path

import Bio
from Bio import Align
from Bio.Align import substitution_matrices


ROOT = Path(__file__).resolve().parents[1]
DESTINO = ROOT / "src" / "features" / "alignment" / "fixtures"
ALFABETO = "ACDEFGHIKLMNPQRSTVWYBZX"
MATRICES = ("BLOSUM45", "BLOSUM62", "BLOSUM80")
CASOS = (
    ("hueco_interno", "ACDEFGHIK", "ACDFGHIK", "global", "BLOSUM62"),
    ("extremos_libres", "GGACDEFGHKK", "ACDEFGH", "global", "BLOSUM62"),
    ("local", "PPACDEFGHKK", "GGACDEFGHTT", "local", "BLOSUM45"),
    ("ambiguos", "ACBZXDE", "ACBZXDE", "global", "BLOSUM80"),
)


def alinear(nombre, primera, segunda, modo, matriz, extremos_libres=True):
    alineador = Align.PairwiseAligner()
    alineador.mode = modo
    alineador.substitution_matrix = substitution_matrices.load(matriz)
    alineador.open_gap_score = -10
    alineador.extend_gap_score = -0.5
    if modo == "global" and extremos_libres:
        # Los aliases solicitados siguen disponibles en Biopython 1.87.
        alineador.end_open_gap_score = 0
        alineador.end_extend_gap_score = 0
    alineamiento = alineador.align(primera, segunda)[0]
    return {
        "nombre": nombre,
        "primera": primera,
        "segunda": segunda,
        "modo": modo,
        "matriz": matriz,
        "extremosLibres": extremos_libres if modo == "global" else False,
        "puntuacion": alineamiento.score,
        "primeraAlineada": alineamiento[0],
        "segundaAlineada": alineamiento[1],
    }


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    matrices = {
        "fuente": "Biopython Bio.Align.substitution_matrices",
        "version": Bio.__version__,
        "alfabeto": ALFABETO,
        "valores": {
            nombre: [[int(substitution_matrices.load(nombre)[a, b]) for b in ALFABETO] for a in ALFABETO]
            for nombre in MATRICES
        },
    }
    (DESTINO / "blosum.json").write_text(json.dumps(matrices, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    casos = [alinear(*caso) for caso in CASOS]
    caso_extremos = next(caso for caso in CASOS if caso[0] == "extremos_libres")
    casos.append(alinear(*caso_extremos, extremos_libres=False))
    (DESTINO / "biopython.json").write_text(
        json.dumps({"version": Bio.__version__, "fechaConsulta": "2026-09-29", "casos": casos}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
