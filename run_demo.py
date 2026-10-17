"""
Start the Helios demo with one command, from the HELIOS folder:

    python run_demo.py                  start the server and open the dashboard in a browser
    python run_demo.py --no-browser     start the server only
    python run_demo.py --save-snapshot  (while ONLINE) save the next working day's forecast
                                        as the offline fallback that ships in git

Before a live pitch: run --save-snapshot on the morning of the demo, so that if the
venue Wi-Fi fails the dashboard shows that morning's forecast (with a clear banner).
"""
import argparse
import shutil
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))


def save_snapshot() -> None:
    from app import config, planner, weather
    day = planner.next_working_day()
    _, info = weather.get_forecast_for_day(day)
    if info["source"] != "live":
        sys.exit("Could not download a fresh forecast (offline?). Snapshot NOT updated.")
    config.DEMO_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    for old in config.DEMO_SNAPSHOT_DIR.glob("forecast_*.json"):
        old.unlink()
    saved = shutil.copy(config.CACHE_DIR / f"forecast_{day.isoformat()}.json", config.DEMO_SNAPSHOT_DIR)
    print(f"Saved offline fallback: {saved}  (commit it to git)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--save-snapshot", action="store_true")
    args = parser.parse_args()

    if args.save_snapshot:
        save_snapshot()
        return

    import uvicorn
    url = f"http://127.0.0.1:{args.port}"
    print(f"Helios is starting at {url}  (press Ctrl+C to stop)")
    if not args.no_browser:
        threading.Timer(2.0, lambda: webbrowser.open(url)).start()
    uvicorn.run("app.main:app", app_dir=str(ROOT / "backend"), host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
