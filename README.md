# centretracker

A Node.js web scraper that monitors the Renfrew Community Centre swimming pool hours page and stores metadata about what was found.

Runs on a scheduled GitHub Actions workflow twice daily (02:00 and 14:00 UTC) and commits the output JSON back to the repository.

## How it works

1. Playwright launches a headless Chromium browser
2. Navigates to the Renfrew Community Centre calendar on the ActiveCommunities portal
3. Waits for the page (a JavaScript SPA) to fully load
4. Reads the page `<title>` and first `<h1>` heading
5. Validates the result isn't a Cloudflare block page
6. Writes the result to `britannia-hours.json`

## Output

`britannia-hours.json` is updated on every successful run:

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
