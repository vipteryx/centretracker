# centretracker

A Node.js web scraper that monitors Vancouver Community Centre swimming pool schedules and stores the data as JSON. Currently tracks **Hillcrest**, **Britannia**, **Vancouver Aquatic Centre**, **Templeton**, **Renfrew**, **Kensington**, **Killarney**, and **Lord Byng** community centres.

Runs on a scheduled GitHub Actions workflow twice daily (02:00 and 14:00 UTC) and commits the output JSON back to the repository.

## How it works

For each venue, the scraper:

1. Launches a headless Chromium browser via Playwright
2. Navigates to the venue's ActiveCommunities calendar (a JavaScript SPA)
3. Intercepts JSON API responses while the page loads; waits an extra 3 s for deferred XHRs
4. Waits for the FullCalendar Web Component's Shadow DOM to render events
5. Extracts the weekly pool session schedule (API interception primary, Shadow DOM fallback)
6. Validates the page isn't a Cloudflare block page
7. Writes a page-summary JSON and a pool-times JSON for that venue

Both venues are scraped in parallel.

## Output files

| File | Venue | Contents |
|---|---|---|
| `page-summary.json` | Hillcrest | Page title + primary heading |
| `pool-times.json` | Hillcrest | Weekly pool session schedule |
| `britannia-page-summary.json` | Britannia | Page title + primary heading |
| `britannia-pool-times.json` | Britannia | Weekly pool session schedule |
| `pool-times-debug-api.json` | Hillcrest | API response previews (CI diagnostic) |
| `pool-times-debug.html` | Hillcrest | Full rendered page HTML (CI diagnostic) |
| `britannia-pool-times-debug-api.json` | Britannia | API response previews (CI diagnostic) |
| `britannia-pool-times-debug.html` | Britannia | Full rendered page HTML (CI diagnostic) |

`pool-times.json` / `britannia-pool-times.json` structure:

```json
{
  "lastUpdated": "2026-03-02T00:00:00.000Z",
  "weekRange": { "start": "2026-03-02", "end": "2026-03-08" },
  "days": [
    {
      "date": "2026-03-02",
      "dayOfWeek": "Monday",
      "sessions": [
        { "name": "Public Swim", "time": "6:00am - 8:00am", "location": "Pool" }
      ]
    }
  ]
}
```

## Setup

```bash
npm ci
npx playwright install --with-deps chromium
```

## Usage

```bash
npm start
```

## Target URLs

| Venue | URL |
|---|---|
| [Hillcrest Community Centre](https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=59&displayType=0&view=2) | locationId=59 |
| [Britannia Community Centre](https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=37&displayType=0&view=2) | locationId=37 |

## Changelog

| Date/Time (UTC)      | Change                                              |
|----------------------|-----------------------------------------------------|
| 2026-02-27 09:22:45  | Initial README created                              |
| 2026-02-27 09:22:45  | Switched target URL to Renfrew ActiveCommunities calendar; updated wait strategy to `networkidle` for SPA rendering |
| 2026-02-27 09:23:55  | Added README maintenance rule to CLAUDE.md to persist across sessions |
| 2026-02-27 09:42:54  | Removed scrapers for britanniacentre.org/pool/ and vancouver.ca/parks-recreation-culture/vancouver-aquatic-centre.aspx; kept only anc.ca.apm.activecommunities.com scraper; deleted scrape-britanniacentre-pool.js, scrape-vancouver-aquatic-centre.js, britanniacentre-pool-hours.json |
| 2026-02-27 10:05:23  | Added extractPoolTimes(): hybrid API-interception/DOM-fallback function that extracts the weekly pool session table and writes pool-times.json; updated CI workflow to commit pool-times.json alongside britannia-hours.json |
| 2026-02-27 10:20:59  | Fix empty pool-times.json: widen JSON capture to all content-types containing "json" (removed URL-fragment filter); replace fixed candidates list in parseApiResponseForSessions with recursive findSessionArray; rewrite DOM fallback using text-pattern matching instead of guessed CSS class names; add debug-page.html dump when both paths yield no sessions |
| 2026-02-27 10:37:18  | Fix DOM fallback to pierce Shadow DOM: replace `document.querySelectorAll("*")` text-pattern walk with Shadow DOM extraction via `document.getElementById('calendar').shadowRoot`; parse session date/time/name/location from `data-date` attributes and `aria-label` strings on FullCalendar Web Component events |
| 2026-02-27 10:57:35  | Remove dead npm scripts referencing non-existent scrape-britanniacentre-pool.js and scrape-vancouver-aquatic-centre.js |
| 2026-02-27 10:59:43  | Fix 4 bugs: parseMonthDay slash format year-rollover, normalizeSessions date fields used as times, sort comparator for equal values, add debug-page.html to .gitignore |
| 2026-02-27 20:51:06  | Rename scrape-britannia-playwright.js → scraper.js and britannia-hours.json → page-summary.json for clarity; update all references in package.json, workflow, CLAUDE.md, README.md |
| 2026-02-28 06:23:34  | Add issues.md documenting five root causes for empty pool-times.json output |
| 2026-02-28 07:12:48  | Add debug-page.html to CI git add so failed extractions leave an inspectable artefact |
| 2026-02-28 07:20:00  | Always save debug-page.html on every scrape run, not only on empty-session failures |
| 2026-03-01 06:24:17  | Update issues.md: mark Issue 3 (debug-page.html not committed) as fixed |
| 2026-03-01 06:38:58  | Fix pool-data extraction: remove debug-page.html from .gitignore (was silently blocking CI commits); fix Shadow DOM fallback to also query document directly when no shadow root exists; add daygrid event selectors; wait for FullCalendar events after networkidle to catch late-loading API calls; log JSON response body previews to diagnose Issue 1 |
| 2026-03-01 20:46:44  | Fix SyntaxError: restore scraper.js from last known good state after prior commits replaced its content with broken placeholder code containing await outside async function |
| 2026-03-02 05:24:11  | Fix Shadow DOM wait: replace waitForSelector (which does not pierce Shadow DOM) with waitForFunction that polls calEl.shadowRoot directly, so the scraper waits until the active-calendar-scheduler Web Component has rendered its events before extracting |
| 2026-03-02 06:34:55  | Update issues.md: mark Issue 5 fully fixed with corrected resolution description; note prior waitForSelector fix was incomplete because it did not pierce Shadow DOM |
| 2026-03-02 06:43:38  | Rename target from Renfrew to Hillcrest Community Centre throughout README.md and CLAUDE.md; locationId=59 was always Hillcrest |
| 2026-03-02 07:09:20  | Fix findSessionArray false-positive on navigation menu API responses: add real-value guard so arrays where every time-like key is null/empty are skipped; add 3s post-networkidle delay for active-calendar-scheduler deferred XHR; broaden shadow DOM selectors; write debug-api-responses.json each run |
| 2026-03-02 07:35:58  | Fix pool-times.json capturing navigation menu items: add post-grouping validation in extractPoolTimes() to reject API responses where no session has a real ISO date and time; fix CI workflow to commit debug-api-responses.json |
| 2026-03-02 07:47:23  | Add index.html: single-line status page showing Hillcrest Pool open/closed based on pool-times.json |
| 2026-03-02 07:51:48  | index.html: when closed, show next opening time and session name below the status line |
| 2026-03-02 08:54:39  | Add Britannia Community Centre scraper: URL_BRITANNIA (locationId=37), britannia-page-summary.json, britannia-pool-times.json; run both venues in parallel from main entry point; update CI workflow to commit Britannia output files |
| 2026-03-02 08:58:03  | Fix race condition: derive debug file paths from outputPath (pool-times-debug-api.json, pool-times-debug.html, britannia-pool-times-debug-api.json, britannia-pool-times-debug.html) so parallel extractPoolTimes calls no longer overwrite each other's debug output |
| 2026-03-02 08:59:34  | Fix stale log message ("debug-page.html") left over from race condition fix; update README for two-venue setup; update issues.md |
| 2026-03-02 09:04:26  | index.html: add Britannia Pool row; redesign with modern card UI (badges, subtle shadows, CSS custom properties) |
| 2026-03-02 10:02:48  | Add Aquatic Centre, Templeton, and Renfrew venues to scraper.js, index.html, and CI workflow |
| 2026-03-02 10:05:01  | Add Kensington, Killarney, and Lord Byng venues to scraper.js, index.html, and CI workflow |
