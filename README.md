# GB Grid Stability Dashboard

This repository contains the final browser-based dashboard developed for the King's College London individual project on GB grid stability under high renewable penetration.

## Live dashboard

The hosted dashboard is available on GitHub Pages:

- Live link: `TO_BE_FILLED_AFTER_PUBLISH`

## Local files

The dashboard runs from these main files:

- `index.html`
- `styles.css`
- `app.js`
- `model.js`
- `validated_cases.json`

## Run locally

Open `index.html` in a browser, or start a simple local server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## What the dashboard includes

- Single-area GB-equivalent frequency model with energy balance and swing-equation dynamics
- Voltage-operability layer with system-strength effects
- Battery, governor, renewable headroom, demand response, SynCon, and GFM controls
- Historical 9 August 2019 benchmark comparison
- Scenario presets, KPI cards, dynamic plots, resilience classification, and sensitivity views

## Scope note

- Frequency and active-power balance are modelled explicitly.
- Voltage is represented as an operability proxy, not as a full reactive-power or multi-bus network study.
