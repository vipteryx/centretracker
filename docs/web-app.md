# Web App — Feature Reference

**File:** `index.html`
**Deployment:** GitHub Pages, served from the repository root
**Dependencies:** None — plain HTML, CSS, and JavaScript with no framework or build step

---

## Overview

A single-page web app that displays the current open/closed status of 8 Vancouver community centre pools and lets users view the full session schedule for today. Data is read directly from the `data/pool/` JSON files committed to the repository.

---

## Venue Cards

The page displays one card per venue, sorted alphabetically:

1. Britannia Pool
2. Hillcrest Pool
3. Kensington Pool
4. Killarney Pool
5. Lord Byng Pool
6. Renfrew Pool
7. Templeton Pool
8. Vancouver Aquatic Centre

Each card is loaded asynchronously via `loadVenue(dataUrl, key)` when the page opens.

---

## Open / Closed Status

`loadVenue` fetches the venue's `*.json` schedule file and compares the current local time (in minutes since midnight) against each session's start and end times:

- **Open** — current time falls within a session's range. Displayed in **green**.
- **Closed** — no session is currently active. Displayed in **red**.
- **Unknown** — the JSON file failed to load or parse. Displayed in **gray**.

The check uses the browser's local timezone — no UTC conversion is performed.

---

## Closing / Next-Opening Time

The right side of each card shows a contextual time:

- **If open:** the session's end time (i.e., when the pool closes).
- **If closed:** the start time of the next upcoming public session.

Below the status badge, the current or next session's name is displayed in smaller text.

---

## Next Session Lookup (`nextSession`)

`nextSession(days, todayStr, nowMin)` scans the day list from today forward and returns the next public session that hasn't started yet. It:

1. Starts from today's date.
2. On today, skips sessions whose start time has already passed.
3. On future days, returns the first public session found.
4. Returns `null` if no future sessions exist in the data.

---

## Expandable Daily Schedule

Clicking or tapping a venue card expands a detail panel showing **today's full session list**:

- Sessions are listed with the time on the left and the activity name on the right.
- The currently-active session is highlighted in **green**.
- "No sessions today" is shown when no public sessions exist for today.
- A chevron (`›`) rotates to indicate open/closed state. The animation is controlled by CSS transition on the `open` class.

Clicking again collapses the panel.

---

## Session Filtering (`isPublic`)

Not all sessions in the JSON are shown. `isPublic(session)` returns `true` only if:

- The session has a non-empty `time` field, **and**
- The session name does not match `/bulkhead/i`

"Bulkhead Move" sessions appear in the raw scraper data as internal maintenance items and are hidden from users.

---

## Real-Time Clock

The footer shows the current local time in `HH:MM` format, updated every 30 seconds via `setInterval`. This helps users confirm the open/closed status is based on the correct moment.

---

## Time Parsing (`parseTime`)

Session times are stored as strings like `"10:30 AM - 12:00 PM"`. Rather than using `Date` objects, `parseTime(str)` converts a 12-hour time string into an integer (minutes since midnight, 0–1439) for simple numeric range comparisons. This avoids timezone and DST complications.

---

## Schedule Rendering (`renderSchedule`)

`renderSchedule(key, data, nowMin, todayStr)` builds the DOM for the expanded schedule panel:

1. Filters today's sessions through `isPublic`.
2. Creates a row element for each session.
3. Marks the active session with a CSS class that applies green styling.
4. Appends a "No sessions today" message if the filtered list is empty.

---

## UI Design

The layout is a centred single column with a max-width of 420px, optimised for mobile.

### CSS Custom Properties

| Property | Purpose |
|---|---|
| `--bg` | Page background (light gray) |
| `--surface` | Card background (white) |
| `--text-primary` | Venue names, session names (near-black) |
| `--text-secondary` | Times and secondary labels (medium gray) |
| `--open-text` | "Open" status and active session highlight (green) |
| `--closed-text` | "Closed" status (red) |
| `--radius` | Rounded card corners (14px) |
| `--shadow` | Card drop shadow |

### Typography

- Venue name: `1rem`, weight 600
- Status text: `0.8rem`, weight 700
- Time / session name: `0.78rem`, secondary color
- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`

---

## Data Loading

Each venue's schedule is fetched from a relative path:

```
data/pool/<venue>.json
```

Fetches are made in parallel when the page loads. A failed fetch (network error or bad JSON) sets that venue's status to "Unknown" without affecting other cards.

---

## No Dependencies

The web app has zero external dependencies:

- No JavaScript framework
- No CSS preprocessor
- No bundler
- No npm packages

It can be opened directly in a browser from the filesystem or served from any static host.
