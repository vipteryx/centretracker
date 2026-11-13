# CentreTracker — Case studies

| # | Milestone | Result |
|---|---|---|
| 1 | Remove Vancouver Aquatic Centre | Shipped; checked in simulator and on iPhone 16 Plus |
| 2 | Accurate open status (iOS) | Shipped; checked in simulator and on iPhone 16 Plus |

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

## Milestone 2: Accurate open status (iOS)

**Initial request:** "critique the design of this", followed by "Propose milestone" (choosing the critique's suggested follow-up).

**Decision points**
- **Scope.** Claude proposed fixing critique items 1–6 plus the footer overlap (correctness first), leaving layout polish, sorting, favourites and VoiceOver out. Agreed by user ("Agree, start").
- **"Lessons and One Lane" counts as Lengths.** Claude asked; user answered "yes".
- **Session-kind keywords.** User answered "IDK", so Claude derived the rules from every session name in `data/pool/*.json`: Lengths = "length" or "one lane"; Public swim = "public" or "free swim"; everything else Other. Templeton's "Lessons (1 Lane only)" left as Other (ambiguous); user agreed the scope with that note.
- **Web app parity.** User chose "later milestone"; logged as a follow-up in todo.txt.
- **Unit tests.** User agreed ("yes") to add the project's first XCTest target.
- **Where to clean names.** In the scraper (`cleanSession`, applied in `buildPoolTimesResult` so both the API and Shadow DOM paths get it), not in the app. The current data files were cleaned with the same rule so the fix shows as soon as it's pushed. Chosen by Claude.
- **Stale vs ahead.** If today isn't in the data but the whole week is still ahead (e.g. scraped next week on a Sunday), show Closed with the first opening instead of Out of date. Chosen by Claude *(refines R2.5)*.
- **Card design.** Open venues show a green dot plus "Lengths until 9 PM" (kind in primary, time in secondary) instead of a pill, keeping green to a small marker. Closed keeps the red pill and "Opens" column. Chosen by Claude.
- **List "Updated" time.** Uses the oldest scrape time across venues so it never overstates freshness. Chosen by Claude.
- **Next opening.** Now the earliest swimmable start, not the first in list order (the old code used list order). Chosen by Claude.

**Revision requests**
none

**Device check**
- Installed on iPhone 16 Plus at the user's request ("Yes, install it"); user confirmed "Works on device".

**Issues and solutions**
- **Raw calendar labels not available.** The debug HTML is saved with `page.content()`, which leaves out the calendar's Shadow DOM, so the cause of the glued names couldn't be traced to a specific parser branch. Fixed by cleaning the session after extraction, which works whichever path produced it.
- **No Node.js locally.** Tested `cleanSession` against 10 real names with macOS JavaScriptCore (`jsc`); applied the same regex to the data files with Python. The scraper itself was not run.
- **Hand-written Xcode project.** No XcodeGen spec, so the `CentreTrackerTests` target was added to `project.pbxproj` by hand, plus a shared scheme with a Test action. `plutil -lint` and `xcodebuild -list` confirm it.

**Result:** Venues count as open only during lengths or public swim; list cards show each kind on now and when its current block ends; Out of date state and a last-updated footer; the schedule footer no longer overlaps rows; first XCTest target (12 tests, all passing). Scraper `cleanSession` splits glued locations, and the Templeton, Kensington and Lord Byng data was cleaned. Checked in the iPhone 17 simulator and on the user's iPhone 16 Plus. Not checked: cleaned names in the app (needs a push), the Out of date pill on screen (unit-tested only), and a real scraper run (no Node locally).
