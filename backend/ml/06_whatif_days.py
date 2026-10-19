"""
Step 6: pick the three real past days for the dashboard's "Day type" what-ifs (Sunny / Average /
Cloudy). No downloads: reads the committed data/processed/solar_history.csv.

Run from the HELIOS folder:
    python backend/ml/06_whatif_days.py
-> data/whatif_days.json (commit it; see app/whatif.py for the rules)
"""
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # lets us import from backend/app
from app import config, whatif  # noqa: E402


def main() -> None:
    history = pd.read_csv(config.PROCESSED_DIR / "solar_history.csv", index_col=0)
    history.index = pd.to_datetime(history.index, utc=True).tz_convert(config.TIMEZONE)
    result = whatif.pick_days(history)
    whatif.WHATIF_PATH.write_text(json.dumps(result, indent=1))
    print(f"{result['complete_days']} complete days in {result['period'][0]} to {result['period'][1]}")
    for name, day in result["days"].items():
        print(f"  {name:8} {day['date']}  {day['ghi_wh_m2']:,.0f} Wh/m2 of sunlight")
    print(f"wrote {whatif.WHATIF_PATH}")


if __name__ == "__main__":
    main()
