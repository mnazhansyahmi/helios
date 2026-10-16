# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-specified: Python FastAPI backend (ML + API) and a React frontend. Build tool
delegated: Vite (fast, free, simple static build that FastAPI serves). Free tools only.
Must run with one command for a live demo (`python run_demo.py`).

## Users

Primary: hackathon judges at the Sime Darby Property University Hackathon (Planet theme,
Energy Efficiency), reading the dashboard on a projector from across a room during a live
pitch. The screen must explain itself in under 10 seconds.

Secondary (imagined day-to-day user, shown but not designed for first): SDP's CREAM
aggregator team, who must match rooftop solar supply with buyer demand hour by hour.

## Product Purpose

Helios is an AI planning tool on top of CREAM in City of Elmina. SDP leases house rooftops,
installs solar, and sends the power through TNB's grid to SDP's commercial buildings within
5 km. Helios forecasts hourly rooftop solar and hourly buyer demand for tomorrow, shares the
solar between buyers each hour, and shows the grid top-up gap and estimated CO2 avoided.
Success in the pitch: judges grasp the supply/demand mismatch (solar peaks at noon, demand
peaks in the afternoon) and trust the numbers because their limits are stated.

## Positioning

Planning, not control: Helios predicts and plans; TNB operates and balances the grid.
Its claim is honest forecasting: every model is scored on held-out data against a simple
guess, and every example, assumed or stand-in figure is labelled.

## Operating Context

Live pitch on a projector, presenter driving the screen. The main interaction is a
fleet-size scenario slider (0-1000 rooftops, default 50) plus a preset button that jumps to
the rooftop count where noon solar equals noon demand. Venue Wi-Fi may fail; the app falls
back to a saved forecast and must say so with a visible banner.

## Capabilities and Constraints

- Three features only: solar forecast, demand forecast, hourly matching (grid top-up + CO2).
  No new features until the dashboard works. A "shift flexible load to noon" suggestion may
  be requested later; it is not in scope now.
- Data labels: REAL (public measured or forecast data), EXAMPLE (made up for the demo),
  STAND-IN (real Florida building data standing in for Elmina buildings). Tags stay small;
  one footnote explains them. The "scenario" label on the slider stays visible.
- Accuracy is shown as one plain sentence ("X% better than a simple guess") with MAE in
  small text.
- Buyer names: "Office A", "Retail building", "Office B".
- Terminology: grid top-up (electricity still needed from the grid), unused surplus,
  CO2 avoided (matched solar x 0.740 kg/kWh, Energy Commission 2024 provisional factor).

## Brand Commitments

Helios has its own identity. No SDP logo or brand colours; SDP, CREAM and City of Elmina are
named in text only, so nothing implies an official SDP product.

## Evidence on Hand

- Held-out accuracy in `backend/reports/accuracy.json`: solar 10% better than a simple guess
  (Apr-Sep 2026, vs satellite estimates, method chosen after testing - disclosed); demand 23%
  better (Jul-Dec 2017, Florida stand-in buildings).
- Live data through `/api/plan`.
- Absent and never to be fabricated: CREAM home counts, MW capacity, batteries, tariffs, real
  rooftop or building locations, SDP meter data, testimonials.

## Product Principles

1. The numbers are the hero: show the mismatch, not decoration (no green-washing imagery).
2. Readable from the back of the room: few words, large type, nothing dense.
3. Honest by default: every figure carries its provenance; limits are stated, not hidden.
4. Planning, never control: no wording or visual that implies Helios dispatches power.
5. Distinct from a generic SaaS admin template.

## Accessibility & Inclusion

Projector conditions: high contrast that survives washed-out projection, no meaning carried
by colour alone, large type.
