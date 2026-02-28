# centretracker

A Node.js web scraper that monitors the Renfrew Community Centre swimming pool hours page and stores metadata about what was found.

Runs on a scheduled GitHub Actions workflow twice daily (02:00 and 14:00 UTC) and commits the output JSON back to the repository.

## How it works

1. Playwright launches a headless Chromium browser
2. Navigates to the Renfrew Community Centre calendar on the ActiveCommunities portal
3. Waits for the page (a JavaScript SPA) to fully load
4. Reads the page `<title>` and first `<h1>` heading
5. Validates the result isn't a Cloudflare block page
6. Writes the result to `page-summary.json`

## Output

`page-summary.json` is updated on every successful run:

```json
{
  "lastUpdated": "2026-02-27T00:00:00.000Z",
  "pageTitle": "<page title>",
  "primaryHeading": "<first h1 heading>"
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

## Target URL

[Renfrew Community Centre — ActiveCommunities Calendar](https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=59&displayType=0&view=2)

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
