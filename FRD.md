# CentreTracker — Feature Requirements

## Milestones

| # | Milestone | Status | Requirements | Done when |
|---|---|---|---|---|
| 1 | Remove Vancouver Aquatic Centre | ✅ Done | R1.1–R1.5 | Aquatic Centre no longer appears in the iOS app or web app, the scraper no longer fetches it, and the app builds and runs in the simulator with the remaining 7 venues. |

## Milestone 1: Remove Vancouver Aquatic Centre

**Requirements**

- **R1.1 — iOS app.** Remove the `aquatic` case (and its display name, slug, address and coordinate) from `ios/CentreTracker/Models/Venue.swift`. The app lists and maps 7 venues.
- **R1.2 — Web app.** Remove the Aquatic Centre card, its map/location entry, its `venueKeys` entry and its `loadVenue(...)` call from `index.html`.
- **R1.3 — Scraper.** Remove `URL_AQUATIC`, `OUTPUT_PATH_AQUATIC`, `POOL_TIMES_PATH_AQUATIC`, their two calls in `Promise.all([...])` and their exports from `scraper/scraper.js`.
- **R1.4 — Data.** Delete `data/pool/aquatic.json`, `aquatic-summary.json`, `aquatic-debug-api.json` and `aquatic-debug.html`.
- **R1.5 — Docs.** Remove Aquatic Centre from `CLAUDE.md`, `README.md` (intro venue list), `docs/ios-app.md`, `docs/web-app.md` and `docs/scraper.md`, and add a `README.md` changelog row.

**Done when**

- `grep -ri aquatic` finds nothing outside historical changelog rows.
- `node -e "require('./scraper/scraper.js')"` loads without error.
- The iOS app builds and runs in the simulator showing 7 venues, list and map.
- `index.html` loads with 7 cards and no console errors.

**Changes to existing requirements:** none (no FRD existed before this milestone).
