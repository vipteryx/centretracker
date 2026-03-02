# Issues: Pool Schedule Extraction

Tracks known issues with `extractPoolTimes()` for all scraped venues (currently **Hillcrest** — `pool-times.json` and **Britannia** — `britannia-pool-times.json`). An empty schedule manifests as `days: []` and `weekRange: { start: null, end: null }` in the output JSON.

---

## ~~Issue 1: API interception heuristic may not match the site's response shape~~ — **FIXED (2026-03-02)**

~~`findSessionArray()` (scraper.js:83) requires the first element of a candidate array to have **both** a time-like key (`/time|date|start|end|when/`) and a name-like key (`/name|title|desc|activ|event/`). If the `activecommunities.com` API uses different key names, the heuristic silently returns `null` and the primary path produces no data.~~

**Root cause confirmed:** The site's navigation/category API response (a list of calendar filter options like "**Choose a Calendar", "**Public Swimming") was passing `findSessionArray()`'s heuristic. It had both name-like and time-like keys with at least one non-null time value, causing it to be mistakenly returned as session data. The grouped output had no real ISO dates and no session times — `pool-times.json` was being written with category labels instead of pool schedule data.

**Resolution:** Added a post-grouping validation step in `extractPoolTimes()` (scraper.js). After calling `groupApiSessionsByDay()` on a candidate API response, the result is now checked: at least one day must have a real ISO date (`/^\d{4}/`) **and** at least one session with a `time` value. Responses that fail this check are logged and skipped; the loop continues to the next captured response. Navigation/category arrays will always fail this check (no dates, no times on sessions).

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

Applies to **both Hillcrest and Britannia** — both venues use the same ActiveCommunities / `active-calendar-scheduler` Web Component.

**To investigate:** Check the live page source for actual class names used on calendar event elements.

---

## ~~Issue 5: `networkidle` may fire before calendar data is fully loaded~~ — **FIXED (2026-03-02)**

~~The scraper waits for `networkidle` (scraper.js:249) before processing responses. In SPAs, the calendar component may trigger additional async requests after the initial idle threshold, causing those responses to be missed by the interception listener.~~

**Original partial fix (2026-03-01):** Added `page.waitForSelector('.fc-event, .fc-timegrid-event, .fc-daygrid-event', { timeout: 10000 })` after `page.goto()`. This was intended to let the SPA fire its calendar API calls before responses were processed, but the fix was incomplete: Playwright's `waitForSelector` does not pierce Shadow DOM, so it always timed out after 10 seconds regardless of whether events had loaded inside the `<active-calendar-scheduler>` Web Component.

**Full resolution (2026-03-02):** Replaced `waitForSelector` with `page.waitForFunction()` (scraper.js:255–264). The function runs in the browser context and polls `document.getElementById('calendar').shadowRoot` directly, returning `true` as soon as a `td[data-date]` or `.fc-event` element is found inside the Shadow Root. This correctly waits up to 15 seconds for the Web Component to render its events, then falls through gracefully if the Shadow Root is inaccessible or empty.

---

## ~~Issue 6: Parallel venue runs overwrote each other's debug output~~ — **FIXED (2026-03-02)**

~~When Hillcrest and Britannia `extractPoolTimes()` calls ran in parallel via `Promise.all`, both wrote to the same hardcoded `debug-api-responses.json` and `debug-page.html` paths. Whichever venue finished last silently discarded the other's debug data.~~

**Resolution:** Debug file paths are now derived from the `outputPath` argument inside `extractPoolTimes()`. `pool-times.json` → `pool-times-debug-api.json` + `pool-times-debug.html`; `britannia-pool-times.json` → `britannia-pool-times-debug-api.json` + `britannia-pool-times-debug.html`. The CI workflow's `git add` command was updated to match. A stale log message that still referenced the old hardcoded `debug-page.html` name was also corrected.
