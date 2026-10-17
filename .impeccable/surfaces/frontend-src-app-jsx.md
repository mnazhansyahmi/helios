---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: ["frontend/src"]
---

# Helios dashboard (single screen)

Scope: the one-screen pitch dashboard served at `/`. Mode: Operate (presenter drives a slider; judges read).
Audience/task: judges on a projector in a lit room must grasp in 10 seconds that rooftop solar peaks at noon while buyer demand peaks in the afternoon, leaving a grid top-up gap. Presenter moves the fleet-size scenario slider (0-1000, default 50) and presses the noon-match preset.
Constraints: no new features; REAL/EXAMPLE/STAND-IN tags small, one footnote; "scenario" label always visible; accuracy as one plain sentence + small MAE text; no SDP branding; nothing implying grid control; no green-washing; no kicker/eyebrow labels.

## Direction contract

THESIS: Tomorrow's plan as a development-site hoarding: one headline legible from the road, the 24h chart as the big render panel, a ruled particulars strip for provenance. Refuses the KPI-tile card grid.

OWN-WORLD: Night-ink printed-vinyl band (#13212E) over white panels; sun amber (#F2A900) is reserved for solar; the grid top-up is ink hatching at 45 degrees; zinc greys for rules. Archivo variable: condensed heavy for the headline and button, normal width for everything else, tabular numerals. One 1px rule weight; square corners; no shadows.

STORY: Judges read the sentence, see amber fill the noon hours and hatching fill the afternoon, and believe the numbers because every figure carries its tag and accuracy line. The presenter slides, then presses the preset.

FIRST VIEWPORT: Top bar (wordmark, tabs 1-4, planned date). Ink band: the day in one sentence (1.4vw, amber solar share), the chosen hour in one giant line (3.5vw), then one row of controls: Play the day, hour slider, rooftop slider with its scenario note, the amber noon-match preset. Below, 3 : 2: the 3D example township (artist's impression; tall amber/hatched bars beside the three buyer buildings, labels next to the bars) and the 24-hour chart with its afternoon-gap callout and an hour marker that follows Play. Bottom: the zinc strip of three buyer cards plus one note on Helios and the tags. (Shipped adaptation, 17 Oct 2026: the Match tab was merged into the Overview at the user's request; accuracy moved to the Solar and Demand tabs, the site plan became the no-WebGL fallback.)

FORM: Development Hoarding, candidate 6 of 7 on the ordered list, seed key 666acd83. Raises: viewport ownership (vertical feed), one kWh scale (botanical folio), SAVED FORECAST stamp (ticket wallet), one hairline weight (design annual), tabular numerals (datamatics). Signature interaction: pressing the preset raises the amber area to meet the demand line at noon while the headline percentage counts up; the afternoon hatching stays.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
