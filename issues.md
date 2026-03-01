# Issues: Empty Schedule JSON (`pool-times.json`)

The `pool-times.json` output contains `days: []` and `weekRange: { start: null, end: null }` because both extraction paths in `extractPoolTimes()` failed to find session data.

---

## Issue 1: API interception heuristic may not match the site's response shape

`findSessionArray()` (scraper.js:83) requires the first element of a candidate array to have **both** a time-like key (`/time|date|start|end|when/`) and a name-like key (`/name|title|desc|activ|event/`). If the `activecommunities.com` API uses different key names, the heuristic silently returns `null` and the primary path produces no data.

**To investigate:** Log all captured JSON response bodies (not just URLs) so the actual key names are visible.

---

## Issue 2: Shadow DOM fallback assumes a specific element ID and structure

The fallback (scraper.js:291–341) looks for `document.getElementById('calendar')` with a `.shadowRoot`. If the platform does not render the calendar as a Shadow DOM Web Component — or uses a different element ID — `shadowRoot` will be `null` and the fallback returns `[]`.

**To investigate:** Inspect the rendered HTML (`debug-page.html` is written when empty) to verify whether `id="calendar"` and a shadow root actually exist.

---

## ~~Issue 3: `debug-page.html` is not committed by CI~~ — **FIXED (2026-02-28)**

~~When both extraction paths fail, `debug-page.html` is saved (scraper.js:346) to help diagnose the issue. However, the GitHub Actions workflow only commits `page-summary.json` (and `pool-times.json`), so the debug file is silently discarded after each run.~~

**Resolution:** Two changes were made on 2026-02-28:
1. `scraper.js` (line 344) now unconditionally saves `debug-page.html` on every run, not only when sessions are empty.
2. `.github/workflows/scrape.yml` (line 36) now includes `debug-page.html` in the `git add` command, so every CI run commits the rendered page HTML to the repository as an inspectable artefact.

---

## Issue 4: FullCalendar CSS class names may have changed

The Shadow DOM query uses `.fc-timegrid-col[data-date]`, `.fc-timegrid-event`, and `.fc-event-start` (scraper.js:297–302). These are FullCalendar v5/v6 class names. If the platform upgraded or customised FullCalendar, these selectors will match nothing.

**To investigate:** Check the live page source for actual class names used on calendar event elements.

---

## Issue 5: `networkidle` may fire before calendar data is fully loaded

The scraper waits for `networkidle` (scraper.js:249) before processing responses. In SPAs, the calendar component may trigger additional async requests after the initial idle threshold, causing those responses to be missed by the interception listener.

**Fix:** Add an explicit wait (e.g. `waitForSelector` on a calendar-specific element) after `goto()` to ensure the calendar has fully rendered before processing.
