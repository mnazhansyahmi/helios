"""
Helios API (FastAPI). Start it with `python run_demo.py` from the HELIOS folder.

Endpoints
  GET /api/plan?rooftops=50&day=2026-10-16   the whole dashboard for one day
  GET /api/accuracy                          held-out accuracy results (full detail)
  GET /api/health                            is the server up?
  GET /docs                                  interactive API docs (FastAPI built-in)
  GET /                                      the dashboard (once frontend/ is built)
"""
import datetime as dt

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import config, planner, reports

app = FastAPI(title="I-SOLAR API", description="Solar and demand planning prototype for CREAM, City of Elmina")


@app.get("/api/plan")
def plan(rooftops: int = Query(config.FLEET_DEFAULT, ge=config.FLEET_MIN, le=config.FLEET_MAX),
         day: dt.date | None = None):
    """Hourly plan for one day (default: the next working day in Selangor) and a fleet-size scenario."""
    try:
        return planner.build_plan(day or planner.next_working_day(), rooftops)
    except RuntimeError as error:   # e.g. no internet AND no saved forecast
        raise HTTPException(status_code=503, detail=str(error))


@app.get("/api/accuracy")
def accuracy():
    return reports.load_accuracy()


@app.get("/api/health")
def health():
    return {"ok": True}


# Serve the built dashboard (frontend/dist) if it exists.
DASHBOARD_DIR = config.BACKEND_DIR.parent / "frontend" / "dist"
if DASHBOARD_DIR.exists():
    app.mount("/", StaticFiles(directory=DASHBOARD_DIR, html=True), name="dashboard")
else:
    @app.get("/", response_class=HTMLResponse)
    def no_dashboard_yet():
        return ("<h1>I-SOLAR API is running</h1><p>The dashboard is not built yet "
                "(run <code>npm run build</code> in <code>frontend/</code>). "
                "Try <a href='/api/plan'>/api/plan</a> or <a href='/docs'>/docs</a>.</p>")
