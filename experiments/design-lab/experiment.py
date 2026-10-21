"""Interactive Colab experiment. No web API, external inference or private input."""

from __future__ import annotations

import argparse
from collections import OrderedDict
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import zipfile


RESIDUES = dict(zip(
    "ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL".split(),
    "ARNDCQEGHILKMFPSTWYV",
))
BACKBONE = {"N", "CA", "C", "O"}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, path: Path, expected: str, config: dict):
    if path.exists() and sha256(path) == expected:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "ProteinForge-experiment"})
    with urllib.request.urlopen(request, timeout=config["timeoutSeconds"]) as response:
        with temporary.open("wb") as stream:
            shutil.copyfileobj(response, stream, length=config["chunkBytes"])
    if sha256(temporary) != expected:
        raise ValueError(f"Downloaded file hash mismatch: {path.name}")
    temporary.replace(path)


def parse_pdb(text: str, chain: str, expected_sequence: str | None = None):
    """Read one standard polymer chain in the first model, with explicit residue keys."""
    residues = OrderedDict()
    model_seen = False
    atom_count = 0
    for line in text.splitlines():
        if line.startswith("MODEL "):
            if model_seen:
                break
            model_seen = True
        if line.startswith("ENDMDL"):
            break
        if not line.startswith("ATOM  ") or line[21:22] != chain:
            continue
        if len(line) < 60:
            raise ValueError("Truncated PDB atom")
        if line[16] not in (" ", "A"):
            continue
        residue_name = line[17:20].strip()
        if residue_name not in RESIDUES:
            raise ValueError("Non-standard polymer residue")
        coordinates = [float(line[a:b]) for a, b in ((30, 38), (38, 46), (46, 54))]
        occupancy = float(line[54:60])
        if not all(math.isfinite(value) for value in (*coordinates, occupancy)):
            raise ValueError("Non-finite atom data")
        if occupancy <= 0:
            continue
        key = (int(line[22:26]), line[26])
        residue = residues.setdefault(key, {"name": residue_name, "atoms": {}, "lines": []})
        if residue["name"] != residue_name:
            raise ValueError("Ambiguous residue identity")
        atom = line[12:16].strip()
        if atom in residue["atoms"]:
            raise ValueError("Duplicate atom in residue")
        residue["atoms"][atom] = coordinates
        residue["lines"].append(line)
        atom_count += 1
    if not residues:
        raise ValueError("Polymer chain is absent")
    for residue in residues.values():
        if not BACKBONE <= residue["atoms"].keys():
            raise ValueError("Incomplete backbone")
    keys = list(residues)
    if keys != sorted(keys):
        raise ValueError("Unordered residue numbering")
    sequence = "".join(RESIDUES[residue["name"]] for residue in residues.values())
    if expected_sequence is not None and sequence != expected_sequence:
        raise ValueError("PDB sequence does not match the exact expected sequence")
    return {
        "chain": chain,
        "sequence": sequence,
        "residueKeys": [[number, insertion.strip()] for number, insertion in residues],
        "ca": [residue["atoms"]["CA"] for residue in residues.values()],
        "atomCount": atom_count,
        "pdb": "\n".join(line for residue in residues.values() for line in residue["lines"]) + "\nTER\nEND\n",
    }


def parse_fasta(text: str):
    entries = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            entries.append({"header": line[1:], "sequence": ""})
        elif entries:
            entries[-1]["sequence"] += line
        else:
            raise ValueError("FASTA sequence before header")
    if not entries or any(not entry["sequence"] for entry in entries):
        raise ValueError("Empty FASTA entry")
    for entry in entries:
        if any(aa not in RESIDUES.values() for aa in entry["sequence"]):
            raise ValueError("Unsupported candidate alphabet or multiple chains")
    return entries


def compare_ca(reference, prediction):
    """Least-squares rigid superposition without reflection; coordinates in angstroms."""
    import numpy as np

    first = np.asarray(reference, dtype=np.float64)
    second = np.asarray(prediction, dtype=np.float64)
    if first.shape != second.shape or first.ndim != 2 or first.shape[1] != 3 or len(first) < 3:
        raise ValueError("Incompatible CA coordinates")
    if not np.isfinite(first).all() or not np.isfinite(second).all():
        raise ValueError("Non-finite CA coordinates")
    first_center = first.mean(axis=0)
    second_center = second.mean(axis=0)
    x, y = first - first_center, second - second_center
    u, _, vt = np.linalg.svd(y.T @ x)
    correction = np.eye(3)
    correction[-1, -1] = 1 if np.linalg.det(u @ vt) >= 0 else -1
    rotation = u @ correction @ vt
    aligned = y @ rotation + first_center
    distances = np.linalg.norm(aligned - first, axis=1)
    return {
        "method": "Kabsch CA least-squares, proper rotation, no outlier exclusion",
        "residuesCompared": len(first),
        "caRmsdAngstrom": float(np.sqrt(np.mean(distances ** 2))),
        "caDistancesAngstrom": distances.tolist(),
        "rotationRowVectors": rotation.tolist(),
        "translation": (first_center - second_center @ rotation).tolist(),
    }


def gpu_memory_mib():
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
        capture_output=True, text=True, timeout=15, check=True,
    )
    return max(float(line.strip()) for line in result.stdout.splitlines() if line.strip())


@contextmanager
def measurement(root: Path, name: str, interval: float):
    import psutil

    stop = threading.Event()
    process = psutil.Process()
    metrics = {"startedAt": datetime.now(timezone.utc).isoformat(), "sampleSeconds": interval,
               "peakProcessTreeRssBytes": 0, "peakGpuDeviceUsedMiB": None,
               "samplerErrors": [], "status": "running"}

    def sample():
        while not stop.is_set():
            try:
                rss = sum(p.memory_info().rss for p in [process, *process.children(recursive=True)] if p.is_running())
                metrics["peakProcessTreeRssBytes"] = max(metrics["peakProcessTreeRssBytes"], rss)
                used = gpu_memory_mib()
                metrics["peakGpuDeviceUsedMiB"] = max(metrics["peakGpuDeviceUsedMiB"] or 0, used)
            except (OSError, subprocess.SubprocessError, psutil.Error, ValueError) as error:
                if not metrics["samplerErrors"]:
                    metrics["samplerErrors"].append(type(error).__name__)
            stop.wait(interval)

    started = time.perf_counter()
    thread = threading.Thread(target=sample, daemon=True)
    thread.start()
    try:
        yield metrics
        metrics["status"] = "completed"
    except BaseException as error:
        metrics.update(status="failed", errorType=type(error).__name__, error=str(error))
        raise
    finally:
        stop.set()
        thread.join(timeout=20)
        metrics["seconds"] = time.perf_counter() - started
        metrics["finishedAt"] = datetime.now(timezone.utc).isoformat()
        write_json(root / "measurements" / f"{name}.json", metrics)


def environment(root: Path, config: dict):
    import torch

    if not torch.cuda.is_available():
        raise RuntimeError("A managed Colab GPU runtime is required; switch the hardware accelerator to GPU")
    gpu = torch.cuda.get_device_properties(0)
    if gpu.total_memory < config["prediction"]["minimumGpuGiB"] * 1024 ** 3:
        raise RuntimeError("The allocated GPU has insufficient VRAM for this experiment")
    if shutil.disk_usage(root).free < config["prediction"]["minimumFreeDiskGiB"] * 1024 ** 3:
        raise RuntimeError("Insufficient free runtime disk space")
    versions = {}
    for package in ("torch", "numpy", "transformers", "accelerate", "huggingface-hub", "tokenizers", "psutil", "safetensors"):
        versions[package] = importlib.metadata.version(package)
    write_json(root / "environment.json", {
        "python": sys.version, "platform": platform.platform(), "packages": versions,
        "torchCuda": torch.version.cuda, "gpu": gpu.name, "gpuMemoryBytes": gpu.total_memory,
        "freeDiskBytes": shutil.disk_usage(root).free,
        "experimentScriptSha256": sha256(Path(__file__)),
        "configSha256": sha256(root / "config.json"),
    })
    (root / "pip-freeze.txt").write_text(subprocess.check_output(
        [sys.executable, "-m", "pip", "freeze"], text=True), encoding="utf-8")


def prepare(root: Path, config: dict):
    environment(root, config)
    source = root / "downloads" / "reference.pdb"
    reference_config = config["reference"]
    download(reference_config["url"], source, reference_config["sha256"], config["download"])
    reference = parse_pdb(source.read_text(), reference_config["chain"], reference_config["sequence"])
    (root / "reference.pdb").write_text(reference["pdb"], encoding="ascii")
    (root / "reference.fasta").write_text(f">{reference_config['id']} chain {reference_config['chain']} experimental reference\n{reference['sequence']}\n")
    write_json(root / "reference.json", {key: value for key, value in reference.items() if key != "pdb"})
    for file, digest in config["design"]["files"].items():
        download(config["design"]["rawBase"] + file, root / "downloads" / "ProteinMPNN" / file,
                 digest, config["download"])
    write_json(root / "provenance.json", {
        "schemaVersion": config["schemaVersion"], "experiment": "known-backbone-sequence-redesign",
        "reference": reference_config, "design": config["design"], "prediction": config["prediction"],
        "limitations": config["limitations"],
    })
    print("Public reference and pinned ProteinMPNN files verified", flush=True)


def design(root: Path, config: dict):
    design_config = config["design"]
    source = root / "downloads" / "ProteinMPNN"
    reference = read_json(root / "reference.json")
    outputs = []
    for run_name in ("design", "design-repeat"):
        command = [sys.executable, str(source / "protein_mpnn_run.py"),
                   "--path_to_model_weights", str(source / "vanilla_model_weights"),
                   "--model_name", design_config["model"], "--pdb_path", str(root / "reference.pdb"),
                   "--pdb_path_chains", config["reference"]["chain"],
                   "--out_folder", str(root / run_name), "--seed", str(design_config["seed"]),
                   "--num_seq_per_target", str(design_config["samples"]), "--batch_size", "1",
                   "--sampling_temp", str(design_config["temperature"]),
                   "--max_length", str(design_config["maxLength"]), "--save_score", "1"]
        write_json(root / "commands" / f"{run_name}.json", command)
        with measurement(root, run_name, config["measurement"]["sampleSeconds"]):
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            (root / f"{run_name}.log").write_text(result.stdout, encoding="utf-8")
            print(result.stdout, flush=True)
            result.check_returncode()
        entries = parse_fasta((root / run_name / "seqs" / "reference.fa").read_text())
        if entries[0]["sequence"] != reference["sequence"]:
            raise ValueError("ProteinMPNN reference sequence mismatch")
        candidates = entries[1:]
        if len(candidates) != design_config["samples"]:
            raise ValueError("Unexpected number of generated samples")
        if any(len(item["sequence"]) != len(reference["sequence"]) for item in candidates):
            raise ValueError("Candidate length mismatch")
        outputs.append(candidates)
    if [item["sequence"] for item in outputs[0]] != [item["sequence"] for item in outputs[1]]:
        raise RuntimeError("Repeated ProteinMPNN generation did not reproduce the sequences")
    index = design_config["selectedSample"] - 1
    candidate = outputs[0][index]
    candidate.update(sample=index + 1, selectedBeforePrediction=True,
                     sequenceSha256=hashlib.sha256(candidate["sequence"].encode("ascii")).hexdigest(),
                     nativeSequenceRecovery=sum(a == b for a, b in zip(candidate["sequence"], reference["sequence"])) / len(reference["sequence"]))
    write_json(root / "candidate.json", candidate)
    (root / "candidate.fasta").write_text(f">ProteinForge sample {index + 1}; generated, not experimentally validated\n{candidate['sequence']}\n")
    write_json(root / "design-summary.json", {"candidates": outputs[0], "repeatSequencesEqual": True})
    print("Candidate selected by fixed sample index; repeat sequence check passed", flush=True)


def predict(root: Path, config: dict):
    import numpy as np
    import torch
    from huggingface_hub import snapshot_download
    from transformers import EsmConfig, EsmForProteinFolding
    from transformers.models.esm.openfold_utils import residue_constants

    prediction = config["prediction"]
    candidate = read_json(root / "candidate.json")
    sequence = candidate["sequence"]
    torch.manual_seed(prediction["seed"])
    torch.cuda.manual_seed_all(prediction["seed"])
    torch.backends.cudnn.benchmark = False
    torch.cuda.reset_peak_memory_stats()
    with measurement(root, "model-download", config["measurement"]["sampleSeconds"]):
        model_path = Path(snapshot_download(
            repo_id=prediction["model"], revision=prediction["revision"],
            allow_patterns=["config.json", prediction["weights"]], token=False,
        ))
        weights = model_path / prediction["weights"]
        if weights.stat().st_size != prediction["weightsBytes"] or sha256(weights) != prediction["weightsSha256"]:
            raise ValueError("Prediction weights do not match the pinned artifact")
    with measurement(root, "model-load", config["measurement"]["sampleSeconds"]):
        model_config = EsmConfig.from_pretrained(model_path, local_files_only=True)
        model_config.esmfold_config.fp16_esm = True
        model = EsmForProteinFolding.from_pretrained(
            model_path, config=model_config, dtype=torch.float16, device_map={"": "cuda:0"},
            low_cpu_mem_usage=True, local_files_only=True, weights_only=True,
        ).eval()
        # Load directly to the GPU in half precision to bound host RAM; only the language model stays half.
        for name, child in model.named_children():
            if name != "esm":
                child.float()
        for name, parameter in model.named_parameters(recurse=False):
            parameter.data = parameter.data.float()
        model.esm.half()
        model.trunk.set_chunk_size(prediction["chunkSize"])
        torch.cuda.synchronize()
    tokens = torch.tensor([[residue_constants.restype_order[aa] for aa in sequence]], device="cuda")
    with measurement(root, "prediction", config["measurement"]["sampleSeconds"]) as metrics:
        torch.cuda.reset_peak_memory_stats()
        with torch.inference_mode():
            output = model(tokens, attention_mask=torch.ones_like(tokens), num_recycles=prediction["recycles"])
        torch.cuda.synchronize()
        metrics["peakTorchAllocatedBytes"] = torch.cuda.max_memory_allocated()
        metrics["peakTorchReservedBytes"] = torch.cuda.max_memory_reserved()
        confidence = output.plddt[0, :, 1].float().cpu().numpy()
        ptm = float(output.ptm[0].item())
        if not np.isfinite(confidence).all() or not np.all((0 <= confidence) & (confidence <= 1)) or not math.isfinite(ptm) or not 0 <= ptm <= 1:
            raise ValueError("Invalid confidence output")
        # This pinned Transformers port returns pLDDT in [0,1]; explicitly export PDB B factors in [0,100].
        pdb_output = dict(output)
        pdb_output["plddt"] = output.plddt * 100
        pdb = model.output_to_pdb(pdb_output)[0]
        structure = parse_pdb(pdb, "A", sequence)
        (root / "prediction.pdb").write_text(pdb, encoding="ascii")
        write_json(root / "prediction.json", {
            "model": prediction["model"], "revision": prediction["revision"],
            "sequence": sequence, "sequenceSha256": candidate["sequenceSha256"],
            "plddtRawScale": [0, 1], "plddtExportScale": [0, 100],
            "meanCaPlddt": float(confidence.mean() * 100), "caPlddt": (confidence * 100).tolist(),
            "ptm": ptm, "precision": "ESM fp16, folding trunk and heads fp32",
            "chain": structure["chain"], "residueCount": len(sequence), "atomCount": structure["atomCount"],
        })
        np.savez_compressed(root / "predicted-aligned-error.npz",
                            pae=output.predicted_aligned_error[0].float().cpu().numpy())
    print("Exact candidate sequence and finite predicted backbone verified", flush=True)


def package(root: Path, config: dict):
    required = ("environment.json", "reference.json", "reference.pdb", "candidate.json", "prediction.json", "prediction.pdb", "design-summary.json")
    missing = [file for file in required if not (root / file).is_file()]
    validations = {"missing": missing, "status": "incomplete"}
    # Invalidate a previous validation before checking potentially changed inputs.
    write_json(root / "validation.json", validations)
    if not missing:
        reference = parse_pdb((root / "reference.pdb").read_text(), config["reference"]["chain"], config["reference"]["sequence"])
        candidate = read_json(root / "candidate.json")
        recorded_prediction = read_json(root / "prediction.json")
        sequence_hash = hashlib.sha256(candidate["sequence"].encode("ascii")).hexdigest()
        if sequence_hash != candidate["sequenceSha256"] or sequence_hash != recorded_prediction["sequenceSha256"] or recorded_prediction["sequence"] != candidate["sequence"]:
            raise ValueError("Prediction provenance is not associated with the candidate")
        if not read_json(root / "design-summary.json")["repeatSequencesEqual"]:
            raise ValueError("Repeated design has not been verified")
        prediction = parse_pdb((root / "prediction.pdb").read_text(), "A", candidate["sequence"])
        comparison = compare_ca(reference["ca"], prediction["ca"])
        write_json(root / "comparison.json", comparison)
        validations.update(status="completed", exactCandidateSequence=True,
                           finiteCoordinates=True, completeBackbone=True, repeatedDesign=read_json(root / "design-summary.json")["repeatSequencesEqual"])
    write_json(root / "validation.json", validations)
    write_json(root / "result-manifest.json", {
        "schemaVersion": config["schemaVersion"], "status": validations["status"],
        "createdAt": datetime.now(timezone.utc).isoformat(), "limitations": config["limitations"],
        "files": [{"path": str(path.relative_to(root)).replace(os.sep, "/"), "bytes": path.stat().st_size,
                   "sha256": sha256(path)} for path in sorted(root.rglob("*"))
                  if path.is_file() and "downloads" not in path.relative_to(root).parts
                  and path.name != "result-manifest.json"],
    })
    archive = root.parent / "proteinforge-design-lab-results.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(root.rglob("*")):
            if path.is_file() and "downloads" not in path.relative_to(root).parts:
                bundle.write(path, arcname=path.relative_to(root))
    # Reopen every exported entry and verify exact bytes against the manifest.
    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
        manifest = json.loads(bundle.read("result-manifest.json"))
        for entry in manifest["files"]:
            data = bundle.read(entry["path"])
            if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
                raise ValueError("Reopened result hash mismatch")
    print(json.dumps({"archive": str(archive), "validation": validations}, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("prepare", "design", "predict", "package"))
    parser.add_argument("--root", type=Path, required=True)
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    if arguments.stage != "package" and (sys.platform != "linux" or not Path("/content").is_dir()):
        raise RuntimeError("Run the experiment interactively in the managed Colab runtime")
    try:
        config = read_json(root / "config.json")
        globals()[arguments.stage](root, config)
    except BaseException as error:
        write_json(root / "failure.json", {"stage": arguments.stage, "type": type(error).__name__,
                                           "message": str(error), "traceback": traceback.format_exc()})
        raise


if __name__ == "__main__":
    main()
