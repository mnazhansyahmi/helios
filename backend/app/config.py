"""
Central settings for Helios.

Every number in this file is one of two kinds, and the comment says which:
  REAL     - taken from a public source (cited next to it)
  ASSUMED  - an example value we picked for the demo
"""
from pathlib import Path

# ---------------------------------------------------------------------------
# Folders
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
RAW_DIR = DATA_DIR / "raw"                  # big downloads, NOT in git
PROCESSED_DIR = DATA_DIR / "processed"      # small cleaned files, in git
CACHE_DIR = DATA_DIR / "cache"              # every live forecast we fetch, NOT in git
DEMO_SNAPSHOT_DIR = DATA_DIR / "demo_snapshot"  # one saved forecast for offline demos, in git
MODELS_DIR = BACKEND_DIR / "models"         # trained ML models
REPORTS_DIR = BACKEND_DIR / "reports"       # accuracy results shown in the dashboard

# ---------------------------------------------------------------------------
# Location (REAL)
# Centre of Elmina, Shah Alam, Selangor - OpenStreetMap Nominatim, checked 2026-10-14.
# ---------------------------------------------------------------------------
ELMINA_LAT = 3.1804
ELMINA_LON = 101.5173
ELEVATION_M = 37                  # Open-Meteo terrain height for this point
TIMEZONE = "Asia/Kuala_Lumpur"

# ---------------------------------------------------------------------------
# Weather data (REAL sources, our choice of model)
# ---------------------------------------------------------------------------
# Weather model used for BOTH the live forecast and the historical accuracy test,
# so the accuracy we report describes the forecast we actually show.
# ECMWF IFS 0.25 deg was picked because it had the lowest day-ahead sunlight error
# against Himawari satellite data over Jul 2024 - Dec 2025 (training months only):
#   ECMWF 101 W/m2, ICON 105, Open-Meteo best_match 105, GFS 148.
WEATHER_MODEL = "ecmwf_ifs025"

# Satellite estimate of the sunlight that actually reached the ground ("what really happened").
# IMPORTANT: this must be named explicitly. Open-Meteo's default satellite setting
# returned values identical to the ERA5 weather model for Elmina, i.e. not satellite data.
SATELLITE_MODEL = "jma_jaxa_himawari"

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_PREVIOUS_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
OPEN_METEO_SATELLITE_URL = "https://satellite-api.open-meteo.com/v1/archive"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# ---------------------------------------------------------------------------
# Carbon (REAL)
# Energy Commission (Suruhanjaya Tenaga), "Grid Emission Factor (GEF) in Malaysia,
# 2022-2024 (Provisional)", published 23-02-2026. Peninsular Malaysia, 2024.
# 0.740 Gg CO2e/GWh is the same number as 0.740 kg CO2e per kWh.
# It is a grid AVERAGE, and it is provisional.
# ---------------------------------------------------------------------------
GRID_EMISSION_FACTOR_KG_PER_KWH = 0.740
GRID_EMISSION_FACTOR_SOURCE = (
    "Energy Commission Malaysia, Grid Emission Factor 2022-2024 (Provisional), "
    "Peninsular Malaysia 2024, published 23 Feb 2026"
)

# ---------------------------------------------------------------------------
# Matching rule (from the project brief: buyers are within 5 km of the rooftops)
# ---------------------------------------------------------------------------
MAX_MATCH_DISTANCE_KM = 5.0

# ---------------------------------------------------------------------------
# Fleet-size scenario slider (ASSUMED - a "what if", not a CREAM figure)
# The 8 example rooftops are archetypes; the slider sets how many real rooftops
# they stand for in total (each archetype = count / 8 rooftops).
# ---------------------------------------------------------------------------
FLEET_MIN, FLEET_MAX, FLEET_DEFAULT = 0, 1000, 50
PRESET_HOUR = 12   # the demo preset matches solar to demand in the 12:00-13:00 hour

# ---------------------------------------------------------------------------
# Solar panel assumptions (ASSUMED - typical values, not CREAM specifications)
# ---------------------------------------------------------------------------
PANEL_TEMP_COEFF_PER_C = -0.004   # output drops ~0.4% per degC above 25 degC (typical silicon)
INVERTER_EFFICIENCY = 0.96        # pvlib PVWatts default
# System losses (dirt, shading, wiring, mismatch, downtime...): the standard
# PVWatts default from NREL, as returned by pvlib.pvsystem.pvwatts_losses().
SYSTEM_LOSSES_PCT = 14.08
