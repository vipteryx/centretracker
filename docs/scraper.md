# Scraper — Feature Reference

**File:** `scraper/scraper.js`
**Runtime:** Node.js 20 (CommonJS)
**Browser automation:** Playwright ^1.50.0 (headless Chromium)

---

## Overview

The scraper visits each Vancouver community centre's ActiveCommunities calendar page and extracts pool session data. All logic lives in a single CommonJS file with no build step.

---

## Venues

8 community centre pools are monitored, each identified by a numeric `locationId` in the ActiveCommunities URL:

| Venue | Location ID |
|---|---|
| Hillcrest Community Centre | 59 |
| Britannia Community Centre | 37 |
| Vancouver Aquatic Centre | 2 |
| Templeton Community Centre | 45 |
| Renfrew Community Centre | 47 |
| Kensington Community Centre | 56 |
| Killarney Community Centre | 36 |
| Lord Byng Community Centre | 10 |

All URLs follow the pattern:
```
https://anc.ca.apm.activecommunities.com/vancouver/calendars?onlineSiteId=0&no_scroll_top=true&defaultCalendarId=55&locationId=<ID>&displayType=0&view=2
```

---

## Parallel Execution

The main entry point (`require.main === module`) launches all 16 scrape operations at once using `Promise.all()` — 2 per venue (page summary + pool times). No venue waits on another. If any operation fails, the process exits with code `1`.

---

## Page Summary Scraping (`scrape`)

`scrape(url, outputPath)` produces a small validation JSON for each venue.

**Steps:**
1. Launches headless Chromium.
2. Navigates to the venue URL.
3. Waits for `networkidle` (up to 60 seconds) to let the JavaScript SPA finish loading.
4. Extracts the `<title>` text and first `<h1>` heading.
5. Calls `assertScrapeLooksValid` to reject Cloudflare block pages.
6. Writes `*-summary.json` with `lastUpdated`, `pageTitle`, and `primaryHeading`.

---

## Pool Times Scraping (`extractPoolTimes`)

`extractPoolTimes(url, outputPath)` extracts the full weekly session schedule using a **hybrid strategy**.

### Primary path — JSON API interception

Before the page navigates, Playwright registers a response listener on every HTTP response. As the ActiveCommunities SPA makes XHR/fetch calls, their JSON bodies are captured in memory.

After `networkidle`, the scraper waits an additional **3 seconds** to catch deferred API calls made by the `<active-calendar-scheduler>` Web Component.

Each captured response is passed to `parseApiResponseForSessions()`, which recursively searches the JSON (up to 6 levels deep) for a valid session array. An array passes the check only if it contains objects with:
- A **name-like field** (e.g., `activityName`, `title`, `description`), **and**
- A **real, non-empty time-like field** (e.g., `startTime`, `start_time`, `time`)

The real-value guard prevents false positives from navigation-menu API responses that have the same shape but null time fields.

Accepted sessions are normalised, grouped into days, and validated to ensure at least one session has both a real ISO date and a real time value.

### Fallback path — Shadow DOM extraction

If API interception yields no sessions, the scraper queries the FullCalendar Web Component's Shadow DOM directly:

```js
document.getElementById('calendar').shadowRoot
```

Event elements are queried using FullCalendar's daygrid selectors; names, dates, times, and locations are parsed from `data-date` attributes and `aria-label` strings.

### Debug artifacts

After every run, two diagnostic files are written and committed:

- **`*-debug-api.json`** — Previews (first 500 chars) of every captured API response. Used to diagnose what the SPA is fetching.
- **`*-debug.html`** — The full rendered page HTML. Used to inspect SPA structure if extraction fails.

---

## Blocklist Validation (`assertScrapeLooksValid`)

Before writing any output, this function throws an error if:

- The `<h1>` heading is absent, **or**
- The page title or heading contains any of the following (case-insensitive):
  - `"attention required"` — Cloudflare interstitial
  - `"sorry, you have been blocked"` — Cloudflare hard block
  - `"cloudflare"` — generic detection

This ensures a Cloudflare challenge page is never committed as pool data.

---

## Helper Functions

| Function | Purpose |
|---|---|
| `normalizeText(value)` | Collapses all internal whitespace to single spaces and trims. |
| `extractPageSummary({ pageTitle, h1Text })` | Builds the summary JSON object with an ISO `lastUpdated` timestamp. |
| `parseMonthDay(str, referenceYear)` | Parses `"Feb 23"` or `"02/23"` to `YYYY-MM-DD` with year-rollover logic. |
| `parseApiResponseForSessions(jsonBody)` | Entry point for recursive API mining. |
| `findSessionArray(obj, depth)` | Depth-limited recursion to locate a session array inside a JSON object. |
| `normalizeSessions(rawSessions)` | Maps raw API fields to the canonical `{ name, time, location?, status? }` schema. |
| `groupApiSessionsByDay(rawSessions, referenceYear)` | Groups a flat session list into days sorted by date, adding `dayOfWeek` for each. |
| `formatTimeValue(raw)` | Converts ISO datetime strings or raw time strings to `"10:00am"` 12-hour format. |
| `loadChromium()` | Tries `playwright`, falls back to `playwright-core`, throws if neither is available. |

---

## Year-Rollover Date Logic

`parseMonthDay` handles month-boundary edge cases:

- Parsed month is **January** and current month is **October–December** → year + 1 (schedule is for next year).
- Parsed month is **November–December** and current month is **January–February** → year − 1 (schedule is from last year).

---

## Safe `require`-able Module

The `require.main === module` guard means the scraper only auto-runs when executed directly:

```bash
node scraper/scraper.js
```

When `require()`d in tests, no network calls or file writes occur.

---

## Output Files

For each venue, the scraper writes four files under `data/pool/`:

| File | Written by | Contents |
|---|---|---|
| `<venue>.json` | `extractPoolTimes` | Full weekly session schedule |
| `<venue>-summary.json` | `scrape` | Page title + primary heading |
| `<venue>-debug-api.json` | `extractPoolTimes` | API response previews |
| `<venue>-debug.html` | `extractPoolTimes` | Full rendered page HTML |

### Schedule file schema

```json
{
  "lastUpdated": "2026-03-08T02:00:00.000Z",
  "weekRange": { "start": "2026-03-08", "end": "2026-03-14" },
  "days": [
    {
      "date": "2026-03-08",
      "dayOfWeek": "Sunday",
      "sessions": [
        {
          "name": "Length Swim (3 lanes x 25m)",
          "time": "6:00 AM - 8:29 AM",
          "location": "Hillcrest Pool"
        }
      ]
    }
  ]
}
```

### Summary file schema

```json
{
  "lastUpdated": "2026-03-08T02:00:00.000Z",
  "pageTitle": "Drop-in Calendars | Vancouver Recreation",
  "primaryHeading": "Drop-in Calendars page"
}
```

---

## Dependencies

```json
{
  "playwright": "^1.50.0"
}
```

No other runtime dependencies. No TypeScript, no bundler, no transpilation.

## Setup

```bash
cd scraper && npm ci
npx playwright install --with-deps chromium
```

Run from the **repository root** so relative output paths resolve correctly:

```bash
node scraper/scraper.js
```
