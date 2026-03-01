# Issues: Empty Schedule JSON (`pool-times.json`)

The `pool-times.json` output contains `days: []` and `weekRange: { start: null, end: null }` because both extraction paths in `extractPoolTimes()` failed to find session data.

---

## Issue 1: API interception heuristic may not match the site's response shape

`findSessionArray()` (scraper.js:83) requires the first element of a candidate array to have **both** a time-like key (`/time|date|start|end|when/`) and a name-like key (`/name|title|desc|activ|event/`). If the `activecommunities.com` API uses different key names, the heuristic silently returns `null` and the primary path produces no data.

**Partial fix (2026-03-01):** The scraper now logs a 300-character preview of each captured JSON response body (in addition to the URL), so future CI runs will reveal the actual response shape if JSON is captured. Inspect the Actions log to see the `Preview:` lines and adjust `findSessionArray()` key regexes accordingly.

---

## ~~Issue 2: Shadow DOM fallback assumes a specific element ID and structure~~ — **FIXED (2026-03-01)**

~~The fallback (scraper.js:291–341) looks for `document.getElementById('calendar')` with a `.shadowRoot`. If the platform does not render the calendar as a Shadow DOM Web Component — or uses a different element ID — `shadowRoot` will be `null` and the fallback returns `[]`.~~

**Resolution:** The fallback now uses the Shadow DOM if `calEl.shadowRoot` is present, but falls back to querying `document` directly when it is not. This means standard (non-Web-Component) FullCalendar installations are now also covered. The daygrid view selectors (`td.fc-daygrid-day[data-date]`, `.fc-daygrid-event`) were also added alongside the existing timegrid selectors.

---

## ~~Issue 3: `debug-page.html` is not committed by CI~~ — **FIXED (2026-03-01)**

~~When both extraction paths fail, `debug-page.html` is saved (scraper.js:346) to help diagnose the issue. However, the GitHub Actions workflow only commits `page-summary.json` (and `pool-times.json`), so the debug file is silently discarded after each run.~~

**Resolution:** Three changes were required:
1. `scraper.js` (line 344) now unconditionally saves `debug-page.html` on every run, not only when sessions are empty.
2. `.github/workflows/scrape.yml` (line 36) includes `debug-page.html` in the `git add` command.
3. `.gitignore` — `debug-page.html` was incorrectly listed here, causing `git add` to silently skip the file (masked by `|| true`). This entry has now been removed so CI can actually commit the file.

---

## Issue 4: FullCalendar CSS class names may have changed

The Shadow DOM query uses `.fc-timegrid-col[data-date]`, `.fc-timegrid-event`, and `.fc-event-start` (scraper.js:297–302). These are FullCalendar v5/v6 class names. If the platform upgraded or customised FullCalendar, these selectors will match nothing.

**To investigate:** Check the live page source for actual class names used on calendar event elements.

---

## ~~Issue 5: `networkidle` may fire before calendar data is fully loaded~~ — **FIXED (2026-03-01)**

~~The scraper waits for `networkidle` (scraper.js:249) before processing responses. In SPAs, the calendar component may trigger additional async requests after the initial idle threshold, causing those responses to be missed by the interception listener.~~

**Resolution:** After `page.goto()` resolves, the scraper now calls `page.waitForSelector('.fc-event, .fc-timegrid-event, .fc-daygrid-event', { timeout: 10000 })`. This gives the SPA additional time to fire its calendar API calls and render events before the response list is processed. If no calendar events appear within 10 seconds the scraper continues normally rather than failing hard.
