# Project Helios

An AI planning tool for rooftop solar sharing in City of Elmina, built for the
Sime Darby Property University Hackathon (Planet theme, Energy Efficiency).

Helios **predicts and plans**: hourly solar supply from rooftops, hourly demand
from buyer buildings, and how the two match. It does **not** control or balance the
grid; TNB does that.

> Prototype. All rooftops, buyer locations and fleet sizes are **example data**,
> not CREAM / SDP information. See "Data honesty" below.

## Quick start (Windows)

One-time setup, from this folder. The demo laptop only needs **Python 3.11+**: the built
dashboard (`frontend/dist/`) is committed, so Node.js is not needed to run the demo.

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements.txt
```

> **Changing the dashboard?** Anyone who edits files in `frontend/` needs Node.js 20+.
> **Rebuild before committing any frontend change**, and commit the updated
> `frontend/dist/` together with your source changes. Otherwise the demo keeps showing
> the old dashboard.
>
> ```bash
> cd frontend && npm install && npm run build
> ```

Check everything works:

```bash
.venv\Scripts\python -m pytest backend/tests
```

Run the demo (opens http://127.0.0.1:8000 in your browser), or double-click `run_demo.bat`:

```bash
.venv\Scripts\python run_demo.py
```

**Before a live pitch**, on the morning of the demo while online, save that day's forecast
as the offline fallback. If the venue Wi-Fi fails, the dashboard then shows this forecast
with a clear "Offline" banner. Commit the new file in `backend/data/demo_snapshot/`.

```bash
.venv\Scripts\python run_demo.py --save-snapshot
```

The dashboard plans the **next working day** in Selangor (skipping weekends and Selangor
public holidays), so on a Friday it shows Monday, using a forecast made 3 days ahead.

The Overview tab draws a 3D **example** township (an artist's impression, not a model of
Elmina) with the hour slider and "Play the day". It needs WebGL; without it (or if the models
fail to load) the Overview shows the 2D site plan instead. The low-poly models are Kenney city
kits (CC0, public domain), bundled in `frontend/public/models/kenney/` with their licences and a
note on what was changed, so it works offline.

API (while running): `/api/plan?rooftops=50` returns the whole dashboard for that day
(add `&day=2026-10-23` for another date);
`/docs` lists every endpoint.

## How it is built

| Part | What it does | Where |
|---|---|---|
| Solar forecast | Weather forecast → pvlib → kWh per rooftop per hour | `backend/app/solar.py` |
| Demand forecast | ML model → kWh per buyer per hour | `backend/app/demand.py` |
| Matching | Shares solar between buyers each hour (a planning estimate); expected grid purchase; estimated CO₂ | `backend/app/matching.py` |
| Day plan | Puts it all together for the dashboard; slider + noon-match preset | `backend/app/planner.py` |
| API | FastAPI server; serves the dashboard too | `backend/app/main.py` |
| Dashboard | React + Vite, five tabs (keys 1–5): Overview (day and hour headlines, Play, hour and rooftop sliders, noon-match preset, 3D example township, 24-hour chart, buyer cards), For SDP (four decisions computed from the plan: allocation %, roofs to sign, storage, reporting), Solar, Demand, About the data | `frontend/src/` |
| Design system | Visual rules for anyone extending the dashboard | `DESIGN.md`, `PRODUCT.md` |

Working on the dashboard with live reload: start the API with `python run_demo.py --no-browser`,
then run `npm run dev` in `frontend/` and open the address it prints.
| Settings and sources | Every number, labelled REAL or ASSUMED | `backend/app/config.py` |
| Example sites | Rooftops and buyers on the map | `backend/app/sites.py` |

ML pipeline (only needed to rebuild the models; outputs are committed):

```bash
.venv\Scripts\python backend/ml/01_get_data.py      # download public data
.venv\Scripts\python backend/ml/02_eval_solar.py    # solar accuracy -> backend/reports/accuracy.json
.venv\Scripts\python backend/ml/03_train_demand.py  # demand models -> backend/models, accuracy.json
.venv\Scripts\python backend/ml/04_eval_solar_lead_time.py  # solar accuracy 1-5 days ahead
```

## Accuracy so far (held-out data)

**Solar, one day ahead: 10% better than a simple guess.** Average error 0.062 kWh per kWp
per daylight hour, vs 0.070 for "the average day for that month". Tested on Apr–Sep 2026,
which the model never saw, against satellite sunlight estimates (there is no public rooftop
meter data).

We also tested an AI correction of the weather forecast. It helped in every season of
2024–25, but over-corrected in 2026: the forecast's sunlight bias dropped from +41 to
+14 W/m². So the demo uses the plain forecast. That choice was made *after* seeing the
test results, and the dashboard says so. With live CREAM meter data, the correction could
be retrained continuously; that is a next step, not part of this prototype.

**Accuracy falls with lead time.** Same method, months and simple guess, forecast made
1 day ahead: 10% better; 2–3 days ahead: 4% better; 4–5 days ahead: 2% better. A Monday
plan made on a Friday is only slightly better than the average day for the month. The
dashboard shows the score for the lead time actually in use (`04_eval_solar_lead_time.py`).

**Demand, hourly per building: 23% lower MAE than "same hour last week" on unseen months
(Florida stand-in buildings).** Average error 19.6 kWh
per building per hour (8% of average use), vs 25.3 for "same hour last week" and 27.9 for
"average for that hour of the week". Tested on Jul–Dec 2017, which the model never saw. It
beats both simple guesses for all three buildings, but only narrowly for the Retail building
(16.4 vs 18.1), which it also over-predicts by ~15 kWh on average.

Limits, stated plainly:
- The buildings are in Orlando, Florida (stand-ins). Elmina's temperature and humidity fall
  within their training range (>99.7% of hours), but usage habits will differ.
- The test uses *measured* temperatures; a real day-ahead temperature forecast adds some error.
- During the Hurricane Irma week (8–17 Sep 2017) the model was worse than the plain
  hour-of-week average (40 vs 32 kWh). It cannot know about closures.
- Adding recent meter readings (yesterday's and last week's) cut error 29% in our Florida
  test (19.6 to 14.0 kWh). The demo does not use meter readings.

## Data sources

| Data | Source | Licence / terms |
|---|---|---|
| Weather forecast (ECMWF IFS model) | [Open-Meteo](https://open-meteo.com) | Free for **non-commercial** use; data CC BY 4.0 |
| Actual sunlight (Himawari satellite) | Open-Meteo Satellite API, JMA/JAXA Himawari | as above |
| Actual temperature and wind (ERA5) | Open-Meteo Historical API | as above |
| Building electricity use | [Building Data Genome 2](https://github.com/buds-lab/building-data-genome-project-2) | CC BY-SA |
| Grid emission factor, 0.740 kg CO₂e/kWh | Energy Commission Malaysia, *Grid Emission Factor (GEF) in Malaysia, 2022-2024 (Provisional)*, Peninsular 2024, published 23 Feb 2026 | public |
| Map | © OpenStreetMap contributors | ODbL |
| Solar physics | [pvlib-python](https://pvlib-python.readthedocs.io) | BSD-3 |

A production deployment for SDP would need a commercial weather-data licence.

## Data honesty

- **REAL**: weather, satellite sunlight, building meter readings, emission factor.
- **EXAMPLE**: rooftop locations, sizes and directions; buyer locations; fleet size (slider).
- **STAND-IN**: buyer demand comes from real buildings in Orlando, Florida (hot, humid
  summers), because no public hourly data exists for Malaysian buildings. They do not
  show Malaysian patterns such as Hari Raya.
- The hourly split between buyers is a **planning estimate**, not the billing rule: CREAM
  bills monthly using each buyer's declared allocation % (EC guideline cl. 9.10, 6.11).
- CO₂ avoided is **estimated** with the 0.740 kg/kWh grid factor (EC 2024 provisional), for
  planning only; it is not a figure for any buyer's ESG reporting.
- Solar accuracy is measured against **satellite estimates** of sunlight, not against
  real rooftop meters (no public CREAM meter data exists).
