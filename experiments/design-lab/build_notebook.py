"""Build a self-contained, output-free Colab notebook from reviewed local sources."""

import json
from pathlib import Path


SOURCE = Path(__file__).resolve().parent
DESTINATION = SOURCE.parents[1] / "notebooks" / "proteinforge-design-lab.ipynb"


def cell(kind, source, name):
    value = {"cell_type": kind, "metadata": {"id": name}, "source": source.strip().splitlines(keepends=True)}
    if kind == "code":
        value.update(execution_count=None, outputs=[])
    return value


def build():
    program = (SOURCE / "experiment.py").read_text(encoding="utf-8")
    config = (SOURCE / "config.json").read_text(encoding="utf-8")
    requirements = (SOURCE / "requirements-colab.txt").read_text(encoding="utf-8")
    setup = '''
#@title Preparar el entorno de Colab / Prepare the Colab environment
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

if sys.platform != "linux" or importlib.util.find_spec("google.colab") is None:
    raise RuntimeError("Open this notebook in a managed Google Colab GPU runtime")
CONFIG = json.loads(CONFIG_TEXT)
gpu = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                     check=True, capture_output=True, text=True).stdout.strip()
print("Allocated GPU:", gpu)
if float(gpu.splitlines()[0].rsplit(",", 1)[1]) / 1024 < CONFIG["prediction"]["minimumGpuGiB"]:
    raise RuntimeError("This notebook needs at least 12 GiB VRAM; do not switch to paid resources")
WORK = Path("/content/proteinforge-design-lab")
WORK.mkdir(exist_ok=True)
if shutil.disk_usage(WORK).free < CONFIG["prediction"]["minimumFreeDiskGiB"] * 1024 ** 3:
    raise RuntimeError("Not enough free space in the managed runtime")
RUN = WORK / datetime.now(timezone.utc).strftime("run-%Y%m%dT%H%M%S%fZ")
RUN.mkdir()
(RUN / "config.json").write_text(CONFIG_TEXT, encoding="utf-8")
(RUN / "experiment.py").write_text(PROGRAM_TEXT, encoding="utf-8")
(RUN / "requirements-colab.txt").write_text(REQUIREMENTS_TEXT, encoding="utf-8")
ENV = WORK / "venv"
# Managed Debian runtimes may omit ensurepip; inherit their existing pip instead.
subprocess.run([sys.executable, "-m", "venv", "--without-pip", "--system-site-packages", str(ENV)], check=True)
PYTHON = str(ENV / "bin" / "python")
subprocess.run([PYTHON, "-m", "pip", "install", "--disable-pip-version-check",
                "--report", str(RUN / "installation-report.json"),
                "-r", str(RUN / "requirements-colab.txt")], check=True)
STAGE_ENV = dict(os.environ, HF_HOME=str(WORK / "model-cache"),
                 HF_HUB_DISABLE_IMPLICIT_TOKEN="1", HF_HUB_DISABLE_TELEMETRY="1", USE_TF="0", USE_FLAX="0")

def run_stage(name):
    command = [PYTHON, "-u", str(RUN / "experiment.py"), name, "--root", str(RUN)]
    print("Stage:", name, "| Results:", RUN, flush=True)
    result = subprocess.run(command, env=STAGE_ENV)
    if result.returncode:
        raise RuntimeError(f"Stage {name} failed. Read its output; the final download cell can export partial evidence.")
print("Environment ready. No private sequence or Drive mount is used.")
'''
    setup = ('#@title Preparar el entorno de Colab / Prepare the Colab environment\n'
             + f"PROGRAM_TEXT = {program!r}\nCONFIG_TEXT = {config!r}\nREQUIREMENTS_TEXT = {requirements!r}\n" + setup.strip())
    cells = [
        cell("markdown", """
# ProteinForge — ensayo de rediseño / sequence redesign experiment

**Objetivo:** estructura experimental conocida → secuencias ProteinMPNN → predicción ESMFold de la primera muestra → comparación y ZIP verificable.

**Goal:** known experimental backbone → ProteinMPNN sequences → ESMFold prediction of the first sample → comparison and verifiable ZIP.

Este caso usa ubiquitina pública **1UBQ, cadena A, 76 residuos**. Rediseña una secuencia; **no genera una forma nueva ni demuestra función o estabilidad experimental**. El ensayo completo aún debe ejecutarse y evaluarse. / This public 76-residue case redesigns a sequence, does not generate a new backbone, and does not establish biological function or experimental stability. The full experiment still needs execution and evaluation.

En **Entorno de ejecución → Cambiar tipo de entorno → GPU**, selecciona una GPU gratuita, si está disponible. Después usa **Ejecutar todas**. No contrates recursos. Colab no garantiza GPU ni duración. / Select a free GPU runtime, if available, then Run all. Do not purchase resources; availability and session duration are not guaranteed.

El cálculo se realiza en Colab. No se monta Drive, no se usa Supabase, no se solicita una clave y no se modifica ProteinForge publicado. Los pesos de predicción requieren descargar unos **8,44 GB** en la máquina de Colab. / Computation runs in Colab. No Drive mount, Supabase access, API key or production change is used. Prediction weights download approximately 8.44 GB into the Colab machine.

Versiones y hashes de entradas fijados; Torch/CUDA/GPU del entorno se registran. Repetición de generación con la misma semilla comprobada; igualdad bit a bit entre equipos distintos no garantizada. / Input versions and hashes are pinned; runtime Torch/CUDA/GPU are recorded. Generation is repeated with the same seed; bitwise equality across different devices is not guaranteed.

Fuentes / Sources: [ProteinMPNN](https://github.com/dauparas/ProteinMPNN), [ESMFold](https://huggingface.co/facebook/esmfold_v1), [Transformers ESM](https://huggingface.co/docs/transformers/en/model_doc/esm), [1UBQ](https://www.rcsb.org/structure/1UBQ), [Colab FAQ](https://research.google.com/colaboratory/faq.html).
""", "introduction"),
        cell("code", setup, "setup"),
        cell("markdown", """
## Referencia e integridad / Reference and integrity
Descarga solo datos públicos y archivos oficiales con revisión y SHA-256 fijados. Valida la cadena y todos los átomos del esqueleto. / Download public data and pinned official files; validate the chain and complete backbone atoms.
""", "reference-notes"),
        cell("code", 'run_stage("prepare")', "prepare"),
        cell("markdown", """
## Rediseño / Sequence redesign
Genera tres secuencias y repite con la misma semilla. La muestra 1 se selecciona **antes de predecir**, sin elegirla por su confianza posterior. El score de ProteinMPNN es una puntuación del modelo, no energía física. / Generate three sequences, repeat with the same seed, and select sample 1 before prediction. ProteinMPNN scores are model likelihood scores, not physical energy.
""", "design-notes"),
        cell("code", 'run_stage("design")\nprint((RUN / "candidate.fasta").read_text())', "design"),
        cell("markdown", """
## Predicción / Prediction
ESMFold recibe la secuencia exacta seleccionada. Valida coordenadas finitas, residuos y esqueleto completo. Registra pLDDT, pTM, memoria y tiempo. Este port entrega pLDDT en 0–1; el PDB y el resumen se exportan explícitamente en 0–100. No es probabilidad de función. / ESMFold receives the exact selected sequence; coordinates, residues and backbone completeness are validated. Confidence, memory and time are recorded; this port's 0–1 pLDDT is explicitly exported on a 0–100 scale. It is not a probability of function.
""", "prediction-notes"),
        cell("code", 'run_stage("predict")\nprint((RUN / "prediction.json").read_text())', "predict"),
        cell("markdown", """
## Comparar y descargar / Compare and download
RMSD de Cα tras superposición rígida sin reflexión, sin excluir residuos. No comparar como si ambas secuencias fueran idénticas: cada posición corresponde al esqueleto de referencia usado para diseñar. El ZIP excluye pesos/cachés y se reabre para verificar sus hashes. / Cα RMSD after rigid superposition without reflection or residue exclusion. Positional correspondence comes from the design backbone, not from identical sequences. Weights and caches are excluded; the ZIP is reopened and its hashes checked.

Si una etapa falla, ejecuta esta última celda para descargar evidencia parcial: figurará **incomplete**, sin inventar resultados. ProteinForge todavía no importa automáticamente este paquete. / If a stage fails, run this final cell to export partial evidence marked incomplete. ProteinForge does not yet import this bundle automatically.
""", "download-notes"),
        cell("code", '''
run_stage("package")
if (RUN / "comparison.json").exists():
    print((RUN / "comparison.json").read_text())
print((RUN / "validation.json").read_text())
from google.colab import files
files.download(str(WORK / "proteinforge-design-lab-results.zip"))
''', "download"),
    ]
    notebook = {"nbformat": 4, "nbformat_minor": 5, "cells": cells, "metadata": {
        "accelerator": "GPU", "colab": {"provenance": [], "name": DESTINATION.name},
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
    }}
    for entry in cells:
        if entry["cell_type"] == "code":
            compile("".join(entry["source"]), entry["metadata"]["id"], "exec")
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(DESTINATION)


if __name__ == "__main__":
    build()
