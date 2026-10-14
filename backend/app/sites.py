"""
Example rooftops and buyer buildings shown on the map.

EVERYTHING HERE IS EXAMPLE DATA. None of it is CREAM / SDP information:
  - Locations are made-up points inside the Elmina area (OpenStreetMap bounding box
    3.160-3.214 N, 101.492-101.529 E). They are NOT real houses or real buildings.
  - Rooftop sizes, tilts and directions are typical residential values we chose.
  - Each example rooftop is an "archetype": the fleet-size slider decides how many
    real rooftops each archetype stands for.
"""
import math

# kwp     = panel size in kilowatt-peak (ASSUMED)
# tilt    = panel angle from flat, degrees (ASSUMED; low tilts are usual near the equator)
# azimuth = direction the panels face: 0 = north, 90 = east, 180 = south, 270 = west (ASSUMED)
ROOFTOPS = [
    {"id": "R1", "name": "Example rooftop 1", "lat": 3.2050, "lon": 101.5000, "kwp": 5.0, "tilt": 10, "azimuth": 180},
    {"id": "R2", "name": "Example rooftop 2", "lat": 3.2000, "lon": 101.5150, "kwp": 6.0, "tilt": 10, "azimuth": 90},
    {"id": "R3", "name": "Example rooftop 3", "lat": 3.1950, "lon": 101.5050, "kwp": 8.0, "tilt": 15, "azimuth": 270},
    {"id": "R4", "name": "Example rooftop 4", "lat": 3.1900, "lon": 101.5230, "kwp": 4.5, "tilt": 10, "azimuth": 0},
    {"id": "R5", "name": "Example rooftop 5", "lat": 3.1850, "lon": 101.4980, "kwp": 10.0, "tilt": 10, "azimuth": 180},
    {"id": "R6", "name": "Example rooftop 6", "lat": 3.1750, "lon": 101.5100, "kwp": 6.5, "tilt": 20, "azimuth": 90},
    {"id": "R7", "name": "Example rooftop 7", "lat": 3.1700, "lon": 101.5000, "kwp": 7.0, "tilt": 10, "azimuth": 270},
    {"id": "R8", "name": "Example rooftop 8", "lat": 3.1650, "lon": 101.5200, "kwp": 5.5, "tilt": 15, "azimuth": 180},
]


# Buyer buildings. Map locations are EXAMPLE points. Each buyer's electricity use comes
# from a REAL building in Orlando, Florida (Building Data Genome 2, site "Panther"),
# used as a STAND-IN because no public hourly data exists for Malaysian buildings.
# Why these three (checked 2026-10-14): no separate chilled-water meter and usage rises
# with outdoor temperature, so their electricity very likely includes air-conditioning.
BUYERS = [
    {"id": "B1", "name": "Office A", "lat": 3.1830, "lon": 101.5130,
     "bdg2_id": "Panther_office_Jesus", "floor_area_m2": 9596,
     "note": "Busy weekdays, quiet weekends"},
    {"id": "B2", "name": "Retail building", "lat": 3.1880, "lon": 101.5080,
     "bdg2_id": "Panther_retail_Felix", "floor_area_m2": 2942,
     "note": "Open 7 days, daytime peak"},
    {"id": "B3", "name": "Office B", "lat": 3.1780, "lon": 101.5180,
     "bdg2_id": "Panther_office_Patti", "floor_area_m2": 14503,
     "note": "Larger office, busy into the evening"},
]


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance between two map points (haversine formula)."""
    earth_radius_km = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * earth_radius_km * math.asin(math.sqrt(a))
