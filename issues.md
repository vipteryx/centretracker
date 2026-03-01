# Issues: Empty Schedule JSON (`pool-times.json`)

The `pool-times.json` output contains `days: []` and `weekRange: { start: null, end: null }` because both extraction paths in `extractPoolTimes()` failed to find session data.

---

## ~~Issue 1: API interception heuristic may not match the site's response shape~~ — **REMOVED (2026-03-01)**

~~`findSessionArray()` (scraper.js:83) requires the first element of a candidate array to have **both** a time-like key (`/time|date|start|end|when/`) and a name-like key (`/name|title|desc|activ|event/`). If the `activecommunities.com` API uses different key names, the heuristic silently returns `null` and the primary path produces no data.~~

**Resolution:** CI confirmed "No JSON responses captured during page load." — the site does not deliver calendar data via JSON API calls at all. The entire API interception path (`page.on("response", ...)`) has been removed. The new primary path instead scans inline `<script>` tags for embedded JSON blobs, which is the typical pattern for SPAs that server-side render or embed their initial state.

---

## ~~Issue 2: Shadow DOM fallback assumes a specific element ID and structure~~ — **REPLACED (2026-03-01)**

~~The fallback (scraper.js:291–341) looks for `document.getElementById('calendar')` with a `.shadowRoot`. If the platform does not render the calendar as a Shadow DOM Web Component — or uses a different element ID — `shadowRoot` will be `null` and the fallback returns `[]`.~~

**Resolution:** The Shadow DOM fallback was replaced with a broader three-strategy DOM scan:
1. Any element with a `[data-date]` attribute (covers FullCalendar and custom widgets without assuming Shadow DOM).
2. Any element with an `[aria-label]` containing both a date-like and time-like string (covers accessible calendar events regardless of markup structure).
3. Any `<tr>` whose text contains both a date-like and time-like string (covers table-based layouts).

The actual page structure is still unknown (see Issue 3 below). The debug HTML committed after the next CI run will reveal which strategy (if any) succeeds, or what selectors to add.

---

## ~~Issue 3: `debug-page.html` is not committed by CI~~ — **TRULY FIXED (2026-03-01)**

~~When both extraction paths fail, `debug-page.html` is saved (scraper.js:346) to help diagnose the issue. However, the GitHub Actions workflow only commits `page-summary.json` (and `pool-times.json`), so the debug file is silently discarded after each run.~~

**Resolution history:**
- 2026-02-28: `scraper.js` was updated to unconditionally save `debug-page.html`, and the CI workflow was updated to `git add debug-page.html`. However the fix was incomplete.
- 2026-03-01: Root cause identified — `debug-page.html` was listed in `.gitignore`, causing the CI `git add` to silently fail with "The following paths are ignored by one of your .gitignore files". Removed `debug-page.html` from `.gitignore`. The file will now be committed on the next CI run.

---

## ~~Issue 4: FullCalendar CSS class names may have changed~~ — **SUPERSEDED (2026-03-01)**

~~The Shadow DOM query uses `.fc-timegrid-col[data-date]`, `.fc-timegrid-event`, and `.fc-event-start` (scraper.js:297–302). These are FullCalendar v5/v6 class names. If the platform upgraded or customised FullCalendar, these selectors will match nothing.~~

**Resolution:** The Shadow DOM / FullCalendar-specific fallback was replaced wholesale (see Issue 2 above). The new DOM scan uses attribute-based selectors (`[data-date]`, `[aria-label]`) that are library-agnostic.

---

## Issue 5: `networkidle` may fire before calendar data is fully loaded

The scraper waits for `networkidle` (scraper.js:249) before processing responses. In SPAs, the calendar component may trigger additional async rendering after the initial idle threshold, so the DOM may not yet reflect the full schedule when extraction runs.

**Status: open.** The `<script>`-tag JSON scan is not affected by render timing (the embedded data is present in the raw HTML). The DOM scan strategies, however, depend on the calendar having rendered its event elements before `networkidle` fires. If the DOM scan still yields nothing after the next CI run, adding an explicit `waitForSelector` on a known calendar element (identified from `debug-page.html`) will be the fix.
