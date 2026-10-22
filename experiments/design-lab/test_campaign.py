"""Protect provenance when a campaign is started again or configured incorrectly."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import campaign


class CampaignSafetyTests(unittest.TestCase):
    def test_existing_campaign_is_preserved_without_starting_a_stage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config.json").write_text(json.dumps({"design": {"samples": 3, "selectedSample": 1}}))
            (root / "campaign").mkdir()
            marker = root / "campaign/previous-evidence.txt"
            marker.write_text("preserve this partial result")
            with patch.object(campaign.sys, "platform", "linux"), patch.object(Path, "is_dir", return_value=True), \
                    patch.object(campaign.subprocess, "Popen") as process:
                with self.assertRaises(FileExistsError):
                    campaign.run(root, "unused-python")
                process.assert_not_called()
            self.assertEqual(marker.read_text(), "preserve this partial result")

    def test_changed_selection_is_rejected_before_creating_results(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config.json").write_text(json.dumps({"design": {"samples": 3, "selectedSample": 2}}))
            with patch.object(campaign.sys, "platform", "linux"), patch.object(Path, "is_dir", return_value=True), \
                    patch.object(campaign.subprocess, "Popen") as process:
                with self.assertRaisesRegex(ValueError, "prespecified first sample"):
                    campaign.run(root, "unused-python")
                process.assert_not_called()
            self.assertFalse((root / "campaign").exists())

    def test_windows_cannot_start_model_execution(self):
        with patch.object(campaign.sys, "platform", "win32"), patch.object(campaign.subprocess, "Popen") as process:
            with self.assertRaisesRegex(RuntimeError, "managed Colab"):
                campaign.run(Path("unused"), "unused-python")
            process.assert_not_called()


if __name__ == "__main__":
    unittest.main()
