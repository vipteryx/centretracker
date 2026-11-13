# CentreTracker — Feature Requirements

## Milestones

| # | Milestone | Status | Requirements | Done when |
|---|---|---|---|---|
| 1 | Remove Vancouver Aquatic Centre | ✅ Done | R1.1–R1.5 | Aquatic Centre no longer appears in the iOS app or web app, the scraper no longer fetches it, and the app builds and runs in the simulator with the remaining 7 venues. |
| 2 | Accurate open status (iOS) | ✅ Done | R2.1–R2.8 | A pool shows as open only when lengths or public swim is on, each card says what's on and until when, stale data is flagged, session names are clean, and the status logic is covered by unit tests. |
| 3 | Closed cards match open cards (iOS) | ✅ Done | R3.1–R3.3 | Closed venues show a red dot and "Closed until <time>" in the same style as open venues' lines, with no pill or right-hand Opens column. |
| 4 | Venue logos on cards (iOS) | Dropped | R4.1–R4.5 | Every venue card shows that centre's logo (or a monogram tile where there is none) on its left, legible in light and dark mode. |

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

## Milestone 3: Closed cards match open cards (iOS)

Requested from the device screenshot on 2026-11-12, after Milestone 2 shipped.

**Requirements**

- **R3.1 — Closed line.** A closed venue's card shows one line in the same style as an open venue's run line: a red dot, "Closed" in semibold primary, then "until <next opening>" in secondary, e.g. "● Closed until 8 PM" or "● Closed until Fri 6:30 AM".
- **R3.2 — No next opening.** If there's no upcoming swimmable session in the data, the line is "● Closed" with nothing after it.
- **R3.3 — Remove the old closed layout.** The red Closed pill and the right-hand "8 PM / Opens" column are removed. Cards are a single left-aligned column.

**Done when**

- In the simulator, closed venues show "● Closed until …" lines matching the open venues' lines in size, weight and spacing.
- Unit tests still pass; the build passes.
- `README.md` changelog row added.

**Changes to existing requirements:** R2.4 said "the pill remains for Closed"; R3.3 replaces that for Closed only. Out of date, Unknown, Unavailable and loading keep their pills unless agreed otherwise.

**Out of scope:** any change to how "open", "closed" or the next opening time are worked out (Milestone 2 logic is unchanged); the schedule screen.

## Milestone 4: Venue logos on cards (iOS)

Requested on 2026-11-12 while Milestone 3 was awaiting its device check. **Dropped** on 2026-11-12 after it was built: the user asked to undo it; no code from it remains.

**Requirements**

- **R4.1 — Logo tile.** Each venue card on the list screen shows a square tile on its left (about 44pt, rounded corners), top-aligned with the venue name. The name and status lines sit to its right.
- **R4.2 — Logo source.** Where a community centre (or the facility that runs the pool) has its own logo, use it, stored as an image in `Assets.xcassets` and named per venue (`Venue.logoAssetName`). Each logo is found on that centre's or the City of Vancouver's own site, and downloaded only after you approve it.
- **R4.3 — Fallback monogram.** A venue with no usable logo shows a monogram tile instead: the venue's initials (e.g. "H", "LB") on a tinted rounded square, the same size as a logo tile.
- **R4.4 — Legible in dark mode.** Logos sit on a light tile background so dark or transparent logos stay visible on the dark card.
- **R4.5 — Accessibility.** The tile is decorative to VoiceOver (the venue name is already read).

**Done when**

- In the simulator, all 7 cards show a logo or monogram tile, aligned consistently, in light and dark mode.
- Unit tests and the build pass.
- `README.md` changelog row added; logo sources recorded in `study.md`.

**Changes to existing requirements:** none.

**Logo sources (user chose "Real logos"; found 2026-11-12, not yet downloaded)**

| Venue | Run by | Proposed file |
|---|---|---|
| Hillcrest | Riley Park Hillcrest Community Association | `hillcrestcommunitycentre.com/wp-content/uploads/2023/08/favicon-300x300.png` (square mark) |
| Britannia | Britannia Community Services Centre Society | `britanniacentre.org/wp-content/uploads/2025/07/cropped-2025-BCC-FavIcon-03-180x180.png` (square mark) |
| Renfrew | Renfrew Park Community Association | `renfrewcc.com/wp-content/themes/renfrew-park-cc/dist/assets/logo.svg` (mark without text) |
| Killarney | Killarney Community Centre Society | `killarneycentre.ca/wp-content/uploads/2024/10/cropped-favicon.png` (square mark, 180px) |
| Kensington | Kensington Community Centre Association | No website or logo found → monogram |
| Templeton | Vancouver Park Board pool | No logo of its own → monogram |
| Lord Byng | Vancouver Park Board pool | No logo of its own → monogram |

**Out of scope:** logos on the schedule screen or web app; the app icon.
