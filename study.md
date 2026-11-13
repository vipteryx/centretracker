# CentreTracker — Case studies

| # | Milestone | Result |
|---|---|---|
| 1 | Remove Vancouver Aquatic Centre | Shipped; checked in simulator and on iPhone 16 Plus |
| 2 | Accurate open status (iOS) | Shipped; checked in simulator and on iPhone 16 Plus |
| 3 | Closed cards match open cards (iOS) | Shipped; checked in simulator and on iPhone 16 Plus |
| 4 | Venue logos on cards (iOS) | Dropped; built and checked in simulator, then undone |

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

## Milestone 3: Closed cards match open cards (iOS)

**Initial request:** "the closed ones should look similar to open, with red dot and 'until x time' similar" (sent with a screenshot of the list on the user's iPhone).

**Decision points**
- **New milestone, not a revision.** Milestone 2 was already merged, so the change became Milestone 3 per the workflow. Chosen by Claude.
- **Other states.** Claude asked whether Out of date, Unavailable and Loading should also switch to the dot style (recommending yes). User agreed the scope as proposed ("Agree, start"), so they keep their pills.
- **Wording.** "Closed until 8 PM" (matches open lines) over "Closed · opens 8 PM". Proposed by Claude, agreed with the scope.

**Revision requests**
none

**Device check**
- Installed on iPhone 16 Plus at the user's request ("Yes, install it"); reinstalled after Milestone 4 was undone; user confirmed "Works on device".

**Issues and solutions**
none

**Result:** Closed venue cards show "● Closed until <next opening>" (or "● Closed" with nothing upcoming) in the same style as open cards; the red Closed pill and right-hand Opens column are gone; Out of date, Unknown, Unavailable and loading keep their pills. 12 unit tests and the build pass. Checked in the iPhone 17 simulator and on the user's iPhone 16 Plus. Not seen on screen: a closed venue with no upcoming session.

## Milestone 4: Venue logos on cards (iOS)

**Initial request:** "include the logo of each pool or community center on the left area of each card"

**Decision points**
- **New milestone.** Logos are a new feature, not a tweak to Milestone 3, so they became Milestone 4. Started while Milestone 3's device check was still unconfirmed, with both in the same working tree. Chosen by Claude; user approved starting ("Approve and start").
- **Real logos vs monograms.** User chose "Real logos".
- **Which logo files.** Claude found logos for Hillcrest (Riley Park Hillcrest Community Association), Britannia (Britannia Community Services Centre Society), Renfrew (Renfrew Park Community Association) and Killarney (Killarney Community Centre Society), using each site's square icon rather than its wide header logo so it fits a square tile. Kensington (no site or logo found) and Templeton and Lord Byng (Park Board pools with no logo of their own) get monograms; Claude advised against reusing the Park Board logo on two cards. User approved the downloads ("Approve and start").

**Revision requests**
- "undo the thumbnail stuff": the milestone was dropped. The logo tile, `Venue.logoAssetName`/`logoFillsTile`/`monogram` and the four logo images were removed; Milestone 3's closed-card changes were kept.

**Issues and solutions**
- **Renfrew logo is CSS-styled SVG.** The file came gzip-compressed and colours its shapes with CSS classes, which asset-catalog SVG rendering may not honour. Rendered it to a 300px PNG with Quick Look (`qlmanage`) instead; all four logos are PNGs.
- **Britannia's icon is a full-bleed square.** Padding it inside the white tile left a white frame, so `Venue.logoFillsTile` lets it fill the tile edge to edge.
- **Noticed, not fixed:** Renfrew's "Weekday Lessons" sessions have the location "1 Lane Available", so a lane is open for swimming, but session kinds only read the name and treat it as Other. Logged as a follow-up.

**Result:** Dropped. The logo tiles were built and checked in the iPhone 17 simulator (light and dark), then removed at the user's request before any commit or device install. The Renfrew "1 Lane Available" follow-up found during this milestone stays in todo.txt.
