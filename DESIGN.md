---
name: Helios
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

# Design System: Helios

## Overview

**Creative North Star: "The Development Hoarding"**

Helios is set like the signboard around a Malaysian development site: built to be read from
the road, which here means from the back of a lit room on a projector. A night-ink vinyl band
carries one giant sentence and the presenter's controls; white panels below hold the 24-hour
chart (the hoarding's big "render") and a site plan; a zinc particulars strip states where
every number comes from. The data is the loudest thing on the page, and nothing decorates it.

Density is deliberately low at the top and rises toward the bottom: the band is for reading in
two seconds, the particulars strip for anyone who walks up close. Rejected on purpose, at the
user's request: the generic SaaS card grid, small dense text, anything implying Helios controls
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
- **Paper** (#ffffff): panels. **Zinc Strip** (#f2f3f4): the particulars strip.
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

One screen with no scrolling at 1920×1080, 1366×768, 1280×720 and 1024×768: band (~33–37%),
panels (fill the rest, chart never under 215px), particulars (~20–30%). Screens 820px tall or
less use a short mode: tighter band and strips, a smaller slider, building notes hidden. The band is a
two-column grid: headline left, presenter controls (preset over slider) right. Panels split
1.8 : 1 (chart : site plan). The particulars strip has three buyer columns plus the accuracy
column, with the footnote spanning below. All type and padding scale with `clamp()` and `vw`.
Side gutter: clamp(16px, 2.6vw, 56px). Below 900px wide everything stacks in reading order,
and a chart narrower than 520px drops to four axis ticks and no region labels. The afternoon
callout extends right when it fits and flips left when it doesn't (late peaks on small
screens), in which case the solar-peak text is dropped so the two never overlap. The scrollbar gutter is reserved
permanently so the page width never shifts.

## Elevation & Depth

Flat. No shadows anywhere. Depth comes from the ink band against paper, and from the hatching.
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
Big condensed rooftop count beside the always-visible "Scenario" label and EXAMPLE tag.
10px track in band-track, amber fill up to the value, 32px square white thumb with a 4px
amber border, a "noon match" tick under the track, end labels 0 and 1,000.

### Provenance tag
Small uppercase outlined label, REAL / EXAMPLE / STAND-IN; colour follows the surface's
secondary ink. One footnote explains all three.

### 24-hour chart (signature component)
Stacked areas: solar used (amber), grid top-up (ink hatching), unused solar (pale amber),
under a 3.5px ink demand line. Direct labels SOLAR and GRID TOP-UP sit inside the regions;
two callouts mark the solar peak (extending left) and the afternoon demand peak with its grid
top-up (extending right). The y-axis keeps headroom over demand, so the amber visibly grows
as the slider moves. Data changes tween over 450ms with an exponential ease-out, and always
land on the true numbers. A hidden table repeats the data for screen readers.

### Site plan
OpenStreetMap tiles in greyscale; amber circles sized by that hour's solar per rooftop group;
ink-framed squares for buyers, filling amber with the share met by solar; labels to the side
away from the centre.

## Do's and Don'ts

### Do:
- **Do** keep amber for solar only, and show grid top-up as ink hatching.
- **Do** tag every example, assumed or stand-in figure, and keep the single footnote.
- **Do** keep the headline a plain sentence with the solar figure in amber.
- **Do** keep the "Scenario: not a CREAM figure" label visible next to the slider.
- **Do** make any animation land on the true numbers even when animation frames are paused.

### Don't:
- **Don't** add KPI tile grids, cards or shadows. This is a hoarding, not a SaaS admin page.
- **Don't** use wording or visuals that imply Helios dispatches or balances power. TNB runs the grid.
- **Don't** add leaves, globes or glowing eco imagery.
- **Don't** put small labels above headings; headings carry their own weight.
- **Don't** use SDP's logo or brand colours.
