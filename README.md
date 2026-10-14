# Project Helios

An AI planning tool for rooftop solar sharing in City of Elmina, built for the
Sime Darby Property University Hackathon (Planet theme, Energy Efficiency).

Helios **predicts and plans**: hourly solar supply from rooftops, hourly demand
from buyer buildings, and how the two match. It does **not** control or balance the
grid; TNB does that.

> Prototype. All rooftops, buyer locations and fleet sizes are **example data**,
> not CREAM / SDP information. See "Data honesty" below.

## Quick start (Windows)

One-time setup, from this folder:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements.txt
```

Check everything works:

```bash
.venv\Scripts\python -m pytest backend/tests
```

_(Demo run command added on Day 4.)_

## How it is built

| Part | What it does | Where |
|---|---|---|
| Solar forecast | Weather forecast → pvlib → kWh per rooftop per hour | `backend/app/solar.py` |
| Demand forecast | ML model → kWh per buyer per hour | `backend/app/demand.py` (Day 3) |
| Matching | Shares solar between buyers each hour; grid top-up; CO₂ | `backend/app/matching.py` (Day 4) |
| Settings and sources | Every number, labelled REAL or ASSUMED | `backend/app/config.py` |
| Example sites | Rooftops and buyers on the map | `backend/app/sites.py` |

ML pipeline (only needed to rebuild the models; outputs are committed):

```bash
.venv\Scripts\python backend/ml/01_get_data.py      # download public data
.venv\Scripts\python backend/ml/02_eval_solar.py    # solar accuracy -> backend/reports/accuracy.json
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
- Solar accuracy is measured against **satellite estimates** of sunlight, not against
  real rooftop meters (no public CREAM meter data exists).
