"""Run all three prespecified samples in separate, auditable Colab experiments."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(root, python):
    if sys.platform != "linux" or not Path("/content").is_dir():
        raise RuntimeError("Run this campaign interactively in managed Colab")
    config = json.loads((root / "config.json").read_text())
    if config["design"]["samples"] != 3 or config["design"]["selectedSample"] != 1:
        raise ValueError("The campaign requires three samples and a prespecified first sample")
    destination = root / "campaign"
    destination.mkdir()  # Refuse to overwrite a previous or partial campaign.
    summaries = []
    for sample in (1, 2, 3):
        case = destination / f"sample-{sample}" / "run"
        case.mkdir(parents=True)
        case_config = json.loads(json.dumps(config))
        case_config["design"]["selectedSample"] = sample
        (case / "config.json").write_text(json.dumps(case_config, indent=2) + "\n")
        names = ["experiment.py", "constraints.py", "requirements-colab.txt", "installation-report.json"]
        if config["design"].get("constraints") is not None:
            names.append("design-draft.json")
        for name in names:
            shutil.copyfile(root / name, case / name)
        for stage in ("prepare", "design", "predict", "package"):
            print(f"Sample {sample}/3 | {stage}", flush=True)
            command = [python, "-u", str(case / "experiment.py"), stage, "--root", str(case)]
            with (case / f"{stage}-stage.log").open("w") as log:
                with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                      text=True, bufsize=1) as process:
                    for line in process.stdout:
                        print(line, end="", flush=True)
                        log.write(line)
                    if process.wait():
                        raise RuntimeError(f"Sample {sample}: {stage} failed; partial files retained at {case}")
        read = lambda name: json.loads((case / name).read_text())
        if read("validation.json")["status"] != "completed":
            raise ValueError(f"Sample {sample} did not complete validation")
        prediction = read("prediction.json")
        archive = case.parent / "proteinforge-design-lab-results.zip"
        summaries.append({
            "sample": sample, "sequence": prediction["sequence"],
            "sequenceSha256": prediction["sequenceSha256"],
            "meanCaPlddt": prediction["meanCaPlddt"], "ptm": prediction["ptm"],
            "caRmsdAngstrom": read("comparison.json")["caRmsdAngstrom"],
            "predictionSeconds": read("measurements/prediction.json")["seconds"],
            "archive": str(archive.relative_to(destination)),
            "archiveBytes": archive.stat().st_size, "archiveSha256": digest(archive),
        })
        print("SAMPLE_RESULT", json.dumps(summaries[-1]), flush=True)
    # Every case must regenerate the same complete sequence set, not just its selected sample.
    sequence_sets = [(destination / f"sample-{sample}/run/design/seqs/reference.fa").read_text()
                     for sample in (1, 2, 3)]
    sequence_bodies = [[line for line in text.splitlines() if line and not line.startswith(">")]
                       for text in sequence_sets]
    if sequence_bodies[0] != sequence_bodies[1] or sequence_bodies[0] != sequence_bodies[2]:
        raise ValueError("The three independent runs generated different sequence sets")
    summary = {"status": "completed", "reference": "1UBQ A", "samples": summaries,
               "sameGeneratedSequenceSet": True, "selection": "All three fixed sample indices; no confidence ranking",
               "limitations": config["limitations"]}
    summary_path = destination / "campaign-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    combined = root / "proteinforge-design-lab-campaign.zip"
    with zipfile.ZipFile(combined, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.write(summary_path, "campaign-summary.json")
        bundle.write(Path(__file__), "campaign.py")
        for entry in summaries:
            bundle.write(destination / entry["archive"], entry["archive"])
    with zipfile.ZipFile(combined) as bundle:
        if bundle.testzip() is not None:
            raise ValueError("Campaign ZIP failed integrity verification")
        for entry in summaries:
            data = bundle.read(entry["archive"])
            if len(data) != entry["archiveBytes"] or hashlib.sha256(data).hexdigest() != entry["archiveSha256"]:
                raise ValueError("Campaign ZIP failed sample hash verification")
    print("CAMPAIGN_RESULT", json.dumps(summary), flush=True)
    print("CAMPAIGN_ARCHIVE", str(combined), combined.stat().st_size, digest(combined), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--python", default=sys.executable)
    arguments = parser.parse_args()
    run(arguments.root.resolve(), arguments.python)
