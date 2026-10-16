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

FIRST VIEWPORT: Ink band (~37% at 1080p): wordmark row with date and source tag; headline left at 3.75vw in two lines; presenter controls right: the amber preset block (the primary action) above the scenario slider with its label. Below: chart panel (1.8 : 1 with the map) with solar-peak and afternoon-peak callouts; site-plan map right. Bottom: particulars strip with buyers, accuracy, footnote. (Shipped adaptation: preset moved from under the headline to the right column, and headline 4.2vw -> 3.75vw, so the whole dashboard fits one 1080p screen; round-1 capture showed the stacked band overflowing.)

FORM: Development Hoarding, candidate 6 of 7 on the ordered list, seed key 666acd83. Raises: viewport ownership (vertical feed), one kWh scale (botanical folio), SAVED FORECAST stamp (ticket wallet), one hairline weight (design annual), tabular numerals (datamatics). Signature interaction: pressing the preset raises the amber area to meet the demand line at noon while the headline percentage counts up; the afternoon hatching stays.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
