# CentreTracker — Case studies

| # | Milestone | Result |
|---|---|---|
| 1 | Remove Vancouver Aquatic Centre | Shipped; checked in simulator and on iPhone 16 Plus |

## Milestone 1: Remove Vancouver Aquatic Centre

**Initial request:** "ok we need to remove the aquatic centre"

**Decision points**
- **Scope of removal.** Remove from iOS app, web app, scraper, data files and docs (not just hide in the UI). Proposed by Claude, agreed by user ("Yes, build it").
- **Existing data files.** Delete `data/pool/aquatic*` rather than keep them as a record. Proposed by Claude, agreed by user.
- **Changelog history.** Keep historical README changelog rows that mention Aquatic Centre. Proposed by Claude, agreed by user.

**Revision requests**
none

**Device check**
- Installed on iPhone 16 Plus at the user's request ("Yes, install it"); user confirmed "Works on device".

**Issues and solutions**
- **Node.js not installed locally.** `node -e "require('./scraper/scraper.js')"` failed with `command not found`. Used macOS JavaScriptCore (`jsc`) to confirm `scraper.js` still parses instead; the scraper itself was not run.
- **Web preview is a static snapshot.** The browser pane loads `index.html` as a snapshot, so JSON fetches could not be exercised; checked the 7 cards render and the click wiring raises no console errors.

**Result:** Aquatic Centre removed from the iOS app (`Venue` enum), web app (`index.html`), scraper (`scraper.js`), data (`data/pool/aquatic*` deleted) and docs. iOS build passed; checked in the iPhone 17 simulator (7 venues listed) and on the user's iPhone 16 Plus. Web page checked in the browser pane (7 cards, no console errors). Scraper syntax-checked only; first real run will be the next scheduled GitHub Actions scrape.
