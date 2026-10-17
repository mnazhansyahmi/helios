# 3D models for the Overview township

Low-poly models by Kenney (www.kenney.nl), downloaded 17 Oct 2026. Every pack is
**Creative Commons Zero (CC0 1.0)**, public domain: free for commercial use, no
attribution required (credited anyway). Each folder keeps its pack's `LICENSE.txt`.

| Folder | Pack | Source | Used |
|---|---|---|---|
| `suburban/` | City Kit (Suburban) 2.0 | https://kenney.nl/assets/city-kit-suburban | 8 house types, 2 trees |
| `commercial/` | City Kit (Commercial) 2.1 | https://kenney.nl/assets/city-kit-commercial | 3 buyer buildings |
| `roads/` | City Kit (Roads) | https://kenney.nl/assets/city-kit-roads | road tiles, street lamp |
| `cars/` | Car Kit | https://kenney.nl/assets/car-kit | 4 cars |

Only the GLB files the township uses are kept. They are served by the app itself,
so the 3D view works offline.

## Changes to the textures (`*/Textures/colormap.png`)

Amber means solar on every Helios screen, so no model may show orange or yellow:

- All packs: every warm colour (reds, oranges, browns, yellows: tree trunks, bricks, road
  lines, shop awnings) is turned into a cool grey of the same lightness; road lines are white,
  as on Malaysian roads.
- `cars/`: the whole texture is greyscale, so the cars are white, grey and dark (no red or green).
- `suburban/`: the pack's default texture (white walls) with the roof strips taken from the
  pack's own "variation C" texture (slate roofs), so the amber roof panels stand out.

The scene itself (layout, panels, bars, sky) is made in code: `frontend/src/tabs/Township.jsx`.
