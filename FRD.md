# CentreTracker — Feature Requirements

## Milestones

| # | Milestone | Status | Requirements | Done when |
|---|---|---|---|---|
| 1 | Remove Vancouver Aquatic Centre | ✅ Done | R1.1–R1.5 | Aquatic Centre no longer appears in the iOS app or web app, the scraper no longer fetches it, and the app builds and runs in the simulator with the remaining 7 venues. |
| 2 | Accurate open status (iOS) | ✅ Done | R2.1–R2.8 | A pool shows as open only when lengths or public swim is on, each card says what's on and until when, stale data is flagged, session names are clean, and the status logic is covered by unit tests. |

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

## Milestone 2: Accurate open status (iOS)

From the 2026-11-12 design critique (items 1, 2, 3, 4, 5, 6 and the footer bug in 8). Today a pool shows "Open" during lessons-only sessions, "Closes" shows the last session of the day even across gaps, and scraper errors leak into session names.

**Requirements**

- **R2.1 — Session kinds.** Each session is classified by its name (case-insensitive, first match wins). Bulkhead/closed sessions stay excluded as today.
  1. **Lengths:** contains "length" or "one lane" (e.g. "Lengths", "Length Swim (50m)", "Lengths with Tot Pool", "Lessons and One Lane").
  2. **Public swim:** contains "public" or "free swim" (e.g. "Public Swim", "Evening Public Swim", "Public Swim -- Main Tank", "Public Swim/ Lessons", "Free Swim").
  3. **Other:** everything else, e.g. "Lessons", "Lessons (1 Lane only)", "Tot Pool Only", "Dive Tank", "Water Slide or Diving Platform", "Aquafit", "Sauna and Whirlpool Only", "Lessons/Swim Club", "Kayak Practice", "School Board", "Statutory Holiday".

  The rules are based on every session name in `data/pool/*.json` as of 2026-11-12.
- **R2.2 — Open means swimmable.** A venue is open only while a Lengths or Public swim session is active. Other sessions still appear in the schedule screen but never make a venue open.
- **R2.3 — "Until" is the end of the current run.** For each kind, the "until" time is the end of the contiguous run of that kind's sessions covering now (back-to-back or overlapping sessions merge), not the last session of the day. When closed, "Opens" is the next start of a Lengths or Public swim session.
- **R2.4 — Card content.** The list card shows one line per kind that is on now, e.g. "Lengths until 9 PM" and "Public swim until 9 PM", covering concurrent sessions. The Open pill and separate green "Closes" column are removed for open venues; the pill remains for Closed, Unknown, Unavailable and Out of date.
- **R2.5 — Stale data.** If the scraped week does not include today, the card shows an "Out of date" pill instead of "Closed / No upcoming". The list screen shows when the data was last updated.
- **R2.6 — Clean session names.** The scraper splits names like "LengthsTempleton Pool" and "Public Swim/ Lessons]Kensington Pool" into a clean name and a location, so `location` is filled and names contain no venue suffix or stray brackets. Re-run the scraper and commit the corrected data.
- **R2.7 — Footer overlap.** The "Updated …" footer on the schedule screen no longer overlaps list rows (give it a background, or move it into the list).
- **R2.8 — Unit tests.** Add an XCTest target covering classification (R2.1), open status (R2.2), run-end times including gaps and overlaps (R2.3), and stale-week handling (R2.5), using fixed dates rather than the clock.

**Done when**

- Unit tests pass, including: every current session name classifies as listed in R2.1; Britannia 4–6:30 PM ("Lessons and One Lane") shows "Lengths until 6:30 PM"; a venue with only "Lessons" on is not open; a morning session followed by an afternoon gap shows the morning end time.
- `grep` of `data/pool/*.json` finds no session name ending in a venue's pool name and no stray `]`.
- In the simulator: the list shows per-kind lines for open venues, Closed/Opens for closed ones, and the schedule footer doesn't overlap rows.
- `README.md` changelog row added.

**Changes to existing requirements:** none. (`index.html` keeps its current `isPublic` logic until a later milestone, so web and iOS will disagree on "open" in the meantime.)

**Out of scope:** web app parity (later milestone), sorting by distance/status, favourites, dimming past sessions, the schedule row layout (time range, location column), reusing the list's data on the schedule screen, VoiceOver grouping, accent colour.
