---
name: I-SOLAR
description: Tomorrow's rooftop-solar plan for CREAM, City of Elmina, set like a development-site hoarding
colors:
  hoarding-ink: "#13212e"
  text-ink: "#0e1a24"
  ink-secondary: "#44515c"
  ink-small-print: "#5a6670"
  band-secondary: "#b9c4ce"
  band-track: "#3a4b5a"
  sun-amber: "#f2a900"
  sun-amber-hover: "#ffbf26"
  sun-edge: "#b97f00"
  sun-pale: "#fce7a6"
  paper: "#ffffff"
  zinc-strip: "#f2f3f4"
  hairline: "#c9ced3"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.75vw, 80px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 75"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(18px, 1.75vw, 38px)"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(19px, 1.5vw, 31px)"
    fontWeight: 800
    lineHeight: 1.1
    fontVariation: "'wdth' 75"
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(13px, .95vw, 18px)"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(10px, .62vw, 12px)"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  none: "0px"
spacing:
  gutter: "clamp(16px, 2.6vw, 56px)"
components:
  button-preset:
    backgroundColor: "{colors.sun-amber}"
    textColor: "{colors.hoarding-ink}"
    rounded: "{rounded.none}"
    padding: "clamp(12px, 1.1vw, 22px) clamp(18px, 1.8vw, 38px)"
  button-preset-hover:
    backgroundColor: "{colors.sun-amber-hover}"
  button-preset-active-state:
    backgroundColor: "transparent"
    textColor: "{colors.sun-amber}"
  tag:
    textColor: "{colors.ink-small-print}"
    rounded: "{rounded.none}"
    padding: "0.05em 0.45em"
---

# Design System: I-SOLAR

## Overview

**Creative North Star: "The Development Hoarding"**

I-SOLAR is set like the signboard around a Malaysian development site: built to be read from
the road, which here means from the back of a lit room on a projector. A night-ink vinyl band
carries the day in one sentence, the chosen hour in one giant line, and the presenter's controls;
below, the hoarding's artist's impression (a 3D example township) stands beside the 24-hour
chart; a zinc strip of buyer cards closes the page. The data is the loudest thing on the page,
and nothing decorates it.

Density is deliberately low at the top and rises toward the bottom: the band is for reading in
two seconds, the buyer cards for anyone who walks up close. Rejected on purpose, at the
user's request: the generic SaaS card grid, small dense text, anything implying I-SOLAR controls
the grid, and green-washing imagery.

**Key Characteristics:**
- One saturated colour, sun amber, and it always means solar.
- Grid top-up is ink hatching, never a second colour.
- Condensed heavy Archivo for anything read from distance; normal width for everything else.
- Square corners, 1px hairlines, no shadows.
- Every figure carries a small REAL / EXAMPLE / STAND-IN tag, explained once in a footnote.

## Colors

A restrained palette: ink, paper and greys, with one amber that is reserved for solar.

### Primary
- **Sun Amber** (#f2a900): solar used in the chart, the noon-match preset button, the slider
  fill, the solar figure in the headline, rooftop markers. Text in amber appears only on the
  ink band (≈8:1), never on white.

### Neutral
- **Hoarding Ink** (#13212e): the band, the demand line, the hatching, buyer markers.
- **Text Ink** (#0e1a24): text on white.
- **Ink Secondary** (#44515c) and **Small-Print Ink** (#5a6670): secondary text and small
  print on white (7:1 and 5.6:1).
- **Band Secondary** (#b9c4ce): secondary text on the ink band (9:1).
- **Band Track** (#3a4b5a): slider track and separators on the band.
- **Paper** (#ffffff): panels. **Zinc Strip** (#f2f3f4): the buyer-card strip.
- **Hairline** (#c9ced3): every divider, at 1px.
- **Sun Edge** (#b97f00) and **Sun Pale** (#fce7a6): the amber area's edge, and unused solar.

### Named Rules
**The Solar-Only Amber Rule.** Amber means solar, everywhere. Never use it for status, alerts,
links or decoration.

**The Hatch-Not-Hue Rule.** Electricity still needed from the grid is shown as ink hatching at
45°, so the gap reads as "missing", not as another energy source.

## Typography

**Display Font:** Archivo Variable at width 75% (self-hosted via @fontsource-variable/archivo, so it works offline)
**Body Font:** Archivo Variable at width 100%

**Character:** one grotesque family doing two jobs, condensed and heavy for signage and normal
for reading, so the page stays one voice.

### Hierarchy
- **Display** (800, clamp(30px, 3.75vw, 80px), 1.02, width 75%): the headline sentence only.
- **Headline** (500, clamp(18px, 1.75vw, 38px)): the supporting line under the headline.
- **Title** (800, clamp(19px, 1.5vw, 31px), width 75%): panel headings, the preset action
  text (clamp(24px, 2.25vw, 48px)), the scenario value, chart callouts and region labels.
- **Body** (400–600, clamp(13px, .95vw, 18px)): legends, buyer rows, labels.
- **Label** (700, clamp(10px, .62vw, 12px), 0.08em, uppercase): REAL / EXAMPLE / STAND-IN tags.

### Named Rules
**The Distance Rule.** Anything a judge must read from the back of the room is set condensed
800 and sized in vw. Small print can be small, but it must say something true.

**The Tabular Rule.** Every figure uses tabular numerals.

## Layout

Five tabs (keys 1–5): Overview, For SDP, Solar, Demand, About the data. Every tab fits one screen with no
scrolling at 1920×1080, 1366×768, 1280×720 and 1024×768. The Overview tells the whole story:
an ink band (the day line, small, grey and on one line; the hour line, the only headline; then one row of controls: Play and a shorter hour slider on the
left, a small "Scenario: 337 roofs" button with a gear on the right, which opens the rooftop slider and
the noon-match preset in a modal), then the 3D township (left, 3 : 2) beside the 24-hour
chart (right), then the buyer cards (three buyers, with one line under them pointing to About the data for the
tags). Clear space (clamp(10px, 1.3vw, 26px)) separates the band, the township/chart row and the cards. When a
screen is crowded the day line shrinks first; the hour line and the chart never do. Screens
820px tall or less use a short mode: tighter band and strips, a smaller slider. Accuracy lives on
the Solar and Demand tabs; the 2D site plan only appears when the township cannot be drawn.
All type and padding scale with `clamp()` and `vw`. Side gutter: clamp(16px, 2.6vw, 56px).
Below 900px wide everything stacks in reading order; a chart narrower than 600px shows every
6 hours on its axis, and one narrower than 460px also drops its region labels. The afternoon
callout extends right when it fits and flips left when it doesn't (late peaks on small
screens), in which case the solar-peak text is dropped so the two never overlap. Desktop screens
reserve no scrollbar gutter (they never scroll); narrow ones do.

## Elevation & Depth

Flat. No shadows anywhere in the interface. Depth comes from the ink band against paper, and from the hatching.
The one exception is inside the Overview's 3D township, which is the hoarding's "artist's
impression" render: sun, sky and cast shadows live inside that picture only, never on UI chrome.
Map labels and chart text use a white halo (text-shadow / SVG paint-order stroke) for
legibility over data, not as depth.

## Shapes

Square corners throughout (0px radius); the only curves are data marks (rooftop circles) and
the chart's smoothed lines. Dividers are 1px hairlines. Provenance tags are 1px outlined
rectangles. Buyer markers are squares that fill amber from the bottom.

## Components

### Buttons
- **Preset (primary action):** amber block, ink text, square, two lines: condensed action
  ("Jump to noon match") over a detail line (rooftop count). Hover lightens to #ffbf26.
- **Pressed / at the match:** turns to an outlined amber frame (3px inset) with amber text,
  "At the noon match".
- **Disabled:** band-track fill with secondary text, when the forecast has no noon sun.
- **Focus:** 3px white outline, 3px offset on the band; 3px ink outline on white.

### Scenario slider
Lives in a modal (the band's ink, a hairline frame, a dimmed backdrop) opened by the small "Scenario:
N roofs" button; Esc, the backdrop or Done closes it, and number keys do not switch tabs while it is
open. Inside: condensed rooftop count beside the always-visible "scenario, not a CREAM figure" note and
EXAMPLE tag, above a 10px track in band-track with amber fill up to the value, a square white
thumb with an amber border, and a "noon match" tick under the track.

### Provenance tag
Small uppercase outlined label, REAL / EXAMPLE / STAND-IN; colour follows the surface's
secondary ink. One footnote explains all three.

### 24-hour chart (signature component)
Stacked areas: solar used (amber), grid top-up (ink hatching), unused solar (pale amber),
under a 3.5px ink demand line. Direct labels SOLAR and GRID TOP-UP sit inside the regions;
two callouts mark the solar peak (extending left) and the afternoon demand peak with its grid
top-up (extending right). The y-axis keeps headroom over demand, so the amber visibly grows
as the slider moves. Data changes tween over 450ms with an exponential ease-out, and always
land on the true numbers. A hidden table repeats the data for screen readers. On the Overview
a 2px ink hour marker (with the hour in an ink tag at its foot) follows the hour slider and
Play; it moves on its own layer, so the chart is never redrawn while the day plays.

### Decision cards (For SDP tab)
Written from SDP's side ("SDP decides…"). A zinc flow strip (Data → Forecast → Decision → Benefit
to SDP, one line each, drawn arrows) above four hairline-divided cards in one row, in this order:
roof yield, allocation %, storage, growth. Each card reads top to bottom: the problem (bold, one
line), its evidence as a small grey chip (a CREAM clause or target) beside the provenance tag, one
big condensed figure with its basis in small print, then, behind a 1px rule directly under the
figure, "SDP decides" and "Benefit to SDP" (any spare height collects at the card's foot). Amber appears only in the
solar-coverage bars (amber over ink hatching). Under the cards, a thin reporting row (expected grid
purchase, estimated CO₂ avoided), then a zinc footer saying it is one day's forecast with example
sites and stand-in buyers. Every figure is computed from the plan (`tabs/sdpNumbers.js`; no new
models, no ringgit, no invented CREAM figures). When 1024×768 is tight, shorten text first, then
shrink type; never drop the problem or benefit lines. Stacks below 900px.

### Site plan (fallback only)
Shown in the township's place when WebGL or the 3D models are unavailable. OpenStreetMap tiles
in faint greyscale; the map always frames the whole 5 km matching ring
(1.5px ink, labelled, centred on the buyers). Amber circles sized in metres by that hour's
solar per rooftop group; ink-framed squares for buyers, filling amber with the share met by
solar. Buyer labels sit on a paper backing with a hairline border (basemap names never show
through) and are placed by measured collision checks: close spots first, then a leader line,
never touching a rooftop dot, another buyer or another label.

### Example township (Overview tab)
The hoarding's artist's impression, set like a sales-gallery scale model: a made-up round town
on a round base whose rim (a 1px ink ring with a small "5 km CREAM limit · not to scale" tag) is
the matching limit, seen through an orthographic camera (no perspective lean), low enough (27°)
that the circle fills the stage's height on wide screens.
Kenney CC0 low-poly models (white walls, slate roofs; every warm hue recoloured to a cool grey
and the cars to greyscale, so amber stays solar-only): Office A, the Office B tower and the
Retail building stand in one row across a round paved plaza, each with its bar just to its
right at the same depth, so nothing stands in front of anything else; around them, three rings
of houses between two ring roads, cut by 8 radial roads into 8 neighbourhoods, one per example
rooftop type, mixing terrace and landed houses; asphalt roads with white dashed lines drawn in
code, trees in the back gardens and a green belt at the rim, a few cars and street lamps. Roof
panels are unlit dark blue cells that turn to true amber with that hour's solar for one roof of
the type. The bars are the scene's loudest objects, taller than the tallest tower, each in a 1px
ink frame (the frame's height = 100% of that hour's need): unlit true amber from the bottom for
the share met by solar (with a soft amber pool of light at its foot, scaled by that share),
unlit ink hatching above for the grid, so both read at dawn and dusk. The sky behind is a CSS
gradient that runs from dawn to dusk in cool blues only; the sun moves east to west and casts
shadows. One-line labels ("Office B · 100% solar"; the kWh are in the buyer cards) on paper with an ink hairline sit as close to their bar as they can without
covering the plaza (right, left, above or below its top, never over another bar, label or tag,
and never with a leader crossing one; the middle bar's label is placed first), joined by a short
1px ink leader ending in a dot; a one-line key ("Amber = solar · hatched = grid") sits at the bottom left. On phones the kWh move into
the key. Drawn only when the hour or size changes; falls back to
the 2D site plan without WebGL or if the models fail to load. Always tagged EXAMPLE.

## Do's and Don'ts

### Do:
- **Do** keep amber for solar only, and show grid top-up as ink hatching.
- **Do** tag every example, assumed or stand-in figure, and keep the single footnote.
- **Do** keep the headline a plain sentence with the solar figure in amber.
- **Do** keep the "Scenario: not a CREAM figure" label visible next to the slider.
- **Do** make any animation land on the true numbers even when animation frames are paused.

### Don't:
- **Don't** add KPI tile grids, cards or shadows. This is a hoarding, not a SaaS admin page.
- **Don't** use wording or visuals that imply I-SOLAR dispatches or balances power. TNB runs the grid.
- **Don't** add leaves, globes or glowing eco imagery.
- **Don't** put small labels above headings; headings carry their own weight.
- **Don't** use SDP's logo or brand colours.
