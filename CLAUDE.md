# CLAUDE.md

This file provides guidance for AI assistants working in this repository.

## Project Overview

**centretracker** is a Node.js web scraper that monitors the Hillcrest Community Centre swimming pool hours page and stores metadata about what was found. It runs on a scheduled GitHub Actions workflow twice daily and commits the output JSON back to the repository.

## Repository Structure

```
centretracker/
├── .github/
│   └── workflows/
│       └── scrape.yml                # Scheduled GitHub Actions workflow
├── data/                             # Shared JSON output (web + iOS)
│   ├── pool/                         # Pool activity (one file per venue)
│   │   ├── hillcrest.json            # Schedule data (auto-committed by CI)
│   │   ├── hillcrest-summary.json    # Page validation metadata
│   │   ├── hillcrest-debug-api.json  # CI diagnostic artefact
│   │   ├── hillcrest-debug.html      # CI diagnostic artefact
│   │   ├── britannia.json
│   │   ├── aquatic.json
│   │   ├── templeton.json
│   │   ├── renfrew.json
│   │   ├── kensington.json
│   │   ├── killarney.json
│   │   └── lord-byng.json
│   ├── gym/                          # Future activity folder (same layout as pool/)
│   └── basketball/                   # Future activity folder
├── scraper/                          # Node.js scraper
│   ├── scraper.js                    # Main scraper script
│   ├── package.json                  # npm project config
│   └── package-lock.json             # Locked dependency versions
├── web/
│   └── index.html                    # Web app (fetches from ../data/)
├── ios/
│   └── CentreTracker/                # SwiftUI iOS app
└── .gitignore                        # Excludes node_modules/
```

## Technology Stack

- **Runtime:** Node.js 20 (CommonJS modules)
- **Browser automation:** Playwright ^1.50.0 (Chromium, headless)
- **CI:** GitHub Actions (`ubuntu-latest`)
- **No transpilation, no bundler, no TypeScript** — plain `.js` files only

## Key File: `scraper/scraper.js`

The entire scraper logic lives in this single file. It exports the following:

| Export | Type | Purpose |
|---|---|---|
| `scrape(url?, outputPath?)` | `async function` | Main entry point; launches browser, scrapes, writes JSON |
| `normalizeText(value)` | `function` | Collapses whitespace and trims a string |
| `extractPageSummary({pageTitle, h1Text})` | `function` | Builds the output object with `lastUpdated`, `pageTitle`, `primaryHeading` |
| `assertScrapeLooksValid({pageTitle, h1Text})` | `function` | Throws if page looks like a Cloudflare block or has no `<h1>` |
| `loadChromium()` | `async function` | Requires `playwright` or falls back to `playwright-core` |
| `BLOCKLIST` | `string[]` | Lowercase phrases that indicate a blocked scrape |
| `URL` | `string` | Target URL (hardcoded) |
| `DEFAULT_OUTPUT_PATH` | `string` | Output file path (`data/pool/hillcrest-summary.json`) |

The file uses `require.main === module` to run `scrape()` when executed directly, so it is safe to `require()` in tests without triggering side effects.

## Output Format

`data/pool/hillcrest-summary.json` (and equivalent per-venue files) is written on every successful run:

```json
{
  "lastUpdated": "2026-02-18T23:46:39.069Z",
  "pageTitle": "<page <title> text>",
  "primaryHeading": "<first <h1> text>"
}
```

This file is committed back to the repository by the CI workflow. Do not treat it as a source file — it is generated output.

## Development Workflow

### Install dependencies

```bash
cd scraper && npm ci
npx playwright install --with-deps chromium
```

`npm ci` is preferred over `npm install` because it respects `package-lock.json` exactly.

### Run the scraper locally

Run from the **repository root** so relative output paths (`data/...`) resolve correctly:

```bash
node scraper/scraper.js
```

Output is written to `data/` in the repository root.

### No build step

There is no compilation, bundling, or transpilation. Edit `.js` files and run them directly.

## Testing

There is no test framework configured. The exported functions (`normalizeText`, `extractPageSummary`, `assertScrapeLooksValid`) are pure or near-pure and can be exercised directly with Node's built-in `assert` module or any test runner (e.g. Jest, Vitest) added as a dev dependency.

When adding tests:
- Place test files alongside the source or in a `tests/` directory.
- Add a `"test"` script to `package.json`.
- Do not rely on network access in unit tests; pass stub values to the exported functions.

## CI / GitHub Actions

**Workflow:** `.github/workflows/scrape.yml`

| Setting | Value |
|---|---|
| Trigger | Cron `0 2,14 * * *` (02:00 and 14:00 UTC daily) + manual `workflow_dispatch` |
| Runner | `ubuntu-latest` |
| Node | 20 |
| Permissions | `contents: write` (to commit the updated JSON) |

**Steps:**
1. Checkout repository
2. Set up Node 20
3. `cd scraper && npm ci` + `npx playwright install --with-deps chromium`
4. `node scraper/scraper.js` (run from repo root)
5. `git add data/ && git commit ... && git push` (skipped if no changes)

## README Maintenance

**Every time a change is made to this repository, `README.md` must be updated:**

1. Get the current UTC timestamp via `date -u '+%Y-%m-%d %H:%M:%S'`.
2. Append a new row to the `## Changelog` table in `README.md` with that timestamp and a short description of the change.
3. Include `README.md` in the same commit as the change.

This applies to all sessions, including new ones. Do not skip this step.

## Conventions and Constraints

- **Single file:** All scraper logic stays in `scraper/scraper.js` unless there is a strong reason to split.
- **CommonJS only:** Use `require()`/`module.exports`, not ES module `import`/`export`.
- **Hardcoded config:** `URL` and `DEFAULT_OUTPUT_PATH` are constants at the top of the file. If configurability is needed, prefer environment variables checked at the top of the file (e.g. `process.env.SCRAPE_URL || URL`).
- **No secrets required:** The workflow needs no API keys or tokens beyond the default `GITHUB_TOKEN` (used implicitly by `git push`).
- **Blocklist validation:** Always call `assertScrapeLooksValid` before writing output to prevent committing Cloudflare challenge pages.
- **Graceful h1 handling:** A missing `<h1>` should not crash with a Playwright timeout; catch the `waitForSelector` error and let `assertScrapeLooksValid` reject the scrape cleanly.

## Data Layout

Data is organized by **activity type** under `data/`, with one file per venue inside each activity folder:

```
data/
  pool/           → data/pool/<venue-slug>.json
  gym/            → data/gym/<venue-slug>.json
  basketball/     → data/basketball/<venue-slug>.json
```

Each `<venue>.json` contains the schedule. Alongside it the scraper auto-writes `<venue>-summary.json`, `<venue>-debug-api.json`, and `<venue>-debug.html` as diagnostic artefacts.

## Adding a New Venue

1. Add a new constants block (`URL_*`, `OUTPUT_PATH_*`) in `scraper/scraper.js`. Use `"data/pool/<slug>.json"` for pool output.
2. Add the new calls to the `Promise.all([...])` block.
3. Add a venue card to `web/index.html` with `loadVenue("../data/pool/<slug>.json", "<key>")`.
4. Add a new `Venue` case to `ios/CentreTracker/Models/Venue.swift` with a `slug` returning `"<slug>"`.
5. The CI workflow commits all of `data/` automatically — no workflow change needed.

## Adding a New Activity

1. Add scraper logic for the new activity (URL + output path `"data/<activity>/<slug>.json"`) in `scraper/scraper.js`.
2. Add the new calls to `Promise.all([...])`.
3. Add UI in `web/index.html` using `loadVenue("../data/<activity>/<slug>.json", ...)`.
4. In `ios/CentreTracker/Models/Venue.swift`, call `venue.activityURL(activity: "<activity>")` to get the URL.

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `pageTitle` is "Attention Required! \| Cloudflare" | Target site is blocking the scraper | Investigate anti-bot mitigation; no code fix needed unless the site changes |
| `Error: No <h1> heading found` | Page loaded but has no `<h1>` element | Check if site structure changed; update selector if needed |
| `Playwright is not installed` | Browsers not downloaded | Run `npx playwright install --with-deps chromium` |
| Workflow commits no changes | Output JSON is identical to previous run | Expected behaviour; `git commit` exits 0 via `|| echo "No changes"` |
