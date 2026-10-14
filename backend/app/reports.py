"""
Reads and writes reports/accuracy.json: the held-out accuracy results that the
dashboard shows. The solar and demand scripts each fill in their own section.
"""
import json

from . import config

ACCURACY_PATH = config.REPORTS_DIR / "accuracy.json"


def load_accuracy() -> dict:
    return json.loads(ACCURACY_PATH.read_text()) if ACCURACY_PATH.exists() else {}


def save_accuracy_section(name: str, section: dict) -> None:
    """Replace one section (e.g. "solar") and keep the others as they are."""
    report = load_accuracy()
    report[name] = section
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ACCURACY_PATH.write_text(json.dumps(report, indent=2))
