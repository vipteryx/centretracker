# CentreTracker iOS App — Functional Requirements Document (FRD)

| | |
|---|---|
| **Document version** | 1.2 |
| **Last updated** | 2026-09-30 |
| **Product** | CentreTracker iOS (`ios/CentreTracker/`) |
| **Platform** | iOS 17.0+, iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`), SwiftUI |
| **Bundle ID** | `com.centretracker.app` |
| **Baseline** | Reverse-documented from the code at commit `284faeb` (+ uncommitted `VenueListView.swift` edits) |

Status legend: ✅ Implemented · ⚠️ Partial / known gap · 🔲 Not implemented (proposed)

Related docs: [ios-app.md](ios-app.md) (technical reference), [scraper.md](scraper.md) (data producer), [web-app.md](web-app.md) (feature-parity counterpart).

---

## 1. Purpose and Scope

### 1.1 Purpose
Let a swimmer see, at a glance, **which Vancouver community-centre pools are open right now**, when each closes or next opens, and the full weekly public-swim schedule for each venue.

### 1.2 In scope
- Read-only display of public pool schedules for 8 venues.
- Live open/closed status derived on-device from scraped schedule data.
- Directions hand-off to Apple Maps / Google Maps.

### 1.3 Out of scope (v1)
- Accounts, login, bookings, payments, or reservations.
- Push notifications, widgets, Live Activities, Watch app.
- Non-pool activities (gym, basketball) — the data layout anticipates them but no UI exists.
- Offline caching, favourites, search, user settings.
- Backend of any kind. The app has no server; it reads static JSON produced by the scraper.

### 1.4 Users
| Persona | Need |
|---|---|
| Casual swimmer | "Can I swim at Hillcrest right now, and until when?" |
| Planner | "Which pool has a public swim tomorrow morning?" |

---

## 2. System Context

```
Community-centre site ──(Playwright scraper, GitHub Actions, 2×/day)──► data/pool/<slug>.json
                                                                              │ (committed to main)
                                          raw.githubusercontent.com ◄─────────┘
                                                    │ HTTPS GET
                                                iOS app
```

**Dependencies:** GitHub raw CDN availability; scraper freshness; the JSON schema in §7. The app performs no scraping itself.

---

## 3. Venues

Fixed at compile time (`Venue` enum). Adding a venue requires an app release (see CLAUDE.md "Adding a New Venue").

| ID | Display name | Slug | Address |
|---|---|---|---|
| hillcrest | Hillcrest | `hillcrest` | 4575 Clancy Loranger Way, Vancouver |
| britannia | Britannia | `britannia` | 1661 Napier St, Vancouver |
| aquatic | Vancouver Aquatic Centre | `aquatic` | 1050 Beach Ave, Vancouver |
| templeton | Templeton | `templeton` | 700 Templeton Dr, Vancouver |
| renfrew | Renfrew | `renfrew` | 2929 E 22nd Ave, Vancouver |
| kensington | Kensington | `kensington` | 5175 Dumfries St, Vancouver |
| killarney | Killarney | `killarney` | 6260 Killarney St, Vancouver |
| lordByng | Lord Byng | `lord-byng` | 3990 W 14th Ave, Vancouver |

Each venue also carries a fixed latitude/longitude used for directions.

---

## 4. Functional Requirements

### 4.1 App shell and navigation

| ID | Requirement | Status |
|---|---|---|
| FR-NAV-01 | The app launches directly into the Venue List screen (single `WindowGroup`; no onboarding or splash). | ✅ |
| FR-NAV-02 | Navigation is a `NavigationStack`: tapping a venue card pushes that venue's Schedule screen; the system back control returns to the list. | ✅ |
| FR-NAV-03 | Both screens use large navigation titles. List title: "Vancouver Pools". Schedule title: the venue display name. | ✅ |

### 4.2 Venue List screen

| ID | Requirement | Status |
|---|---|---|
| FR-LIST-01 | Show one card per venue (8), sorted alphabetically by display name. | ✅ |
| FR-LIST-02 | On first appearance, load all 8 venue schedules **concurrently**. A failure for one venue must not block or affect the others. | ✅ |
| FR-LIST-03 | Each card shows the venue name and a status pill: **Open** (green), **Closed** (red), **Unknown** (grey), **Unavailable** (grey, load failed with no data), or **…** (grey, loading with no data). | ✅ |
| FR-LIST-04 | When **Open**, the card shows the closing time (end of the day's last public session) with the caption "Closes", and a secondary line "`<session name> · <time range>`" for the session currently running. | ✅ |
| FR-LIST-05 | When **Closed** and a next public session exists, show its start time with caption "Opens": time only if later today (e.g. `6 AM`), or `Ddd h AM/PM` if on a later day (e.g. `Sun 10 AM`). | ✅ |
| FR-LIST-06 | When **Closed** and no further public session exists in the loaded data, show "No upcoming". | ✅ |
| FR-LIST-07 | When today's date is outside the scraped week, search the loaded days for the next future day with a public session and use it for FR-LIST-05. | ✅ |
| FR-LIST-08 | Status re-evaluates every 60 s from the device clock (interpreted in America/Vancouver per BR-09) without any network call, so cards flip Open↔Closed while the app stays in the foreground. | ✅ |
| FR-LIST-09 | Cards adapt to Light/Dark mode using system grouped-background colours. | ✅ |
| FR-LIST-10 | The list supports pull-to-refresh to reload all venues. | 🔲 |
| FR-LIST-11 | Data is re-fetched when the app returns to the foreground after a long absence. Currently the list loads once per launch. | ⚠️ |

### 4.3 Venue Schedule screen

| ID | Requirement | Status |
|---|---|---|
| FR-SCH-01 | On appearance, load that venue's schedule (fresh fetch, independent of the list's copy). | ✅ |
| FR-SCH-02 | While loading with no data: centred progress indicator "Loading schedule…". | ✅ |
| FR-SCH-03 | On failure with no data: an "Unable to Load" unavailable-content view (wifi-slash icon) with the error's localized description. | ✅ |
| FR-SCH-04 | Show an address row with a **Directions** menu offering **Apple Maps** and **Google Maps**. Apple Maps opens `maps.apple.com` with the venue coordinates as destination and the address as query; Google Maps opens `google.com/maps/dir` with the coordinates as destination. | ✅ |
| FR-SCH-05 | A **Today** section appears first, headed "Today · `<Weekday>`, `<Mon d>`" in the tint colour. It lists today's public sessions in start order. | ✅ |
| FR-SCH-06 | If today has no public sessions: "No sessions today". If today is not in the loaded week: "Schedule not available — pull to refresh". | ✅ |
| FR-SCH-07 | The session currently in progress is highlighted green (time, name, semibold). Only the Today section can highlight. | ✅ |
| FR-SCH-08 | One section per **later** day in the loaded data, headed "`<Weekday>`, `<Mon d>`". Past days are not shown. A day with no public sessions shows "Closed". If today is not in the data, all days are listed. | ✅ |
| FR-SCH-09 | Each session row shows: start time (top) and end time (below, smaller); session name; and, when non-empty, the location (trailing, tertiary). | ✅ |
| FR-SCH-10 | Pull-to-refresh reloads the schedule. A failed refresh must not discard already-displayed data. | ✅ |
| FR-SCH-11 | A bottom inset shows "Updated `<relative time>`" from the JSON `lastUpdated` field (e.g. "Updated 3 hours ago"). | ✅ |
| FR-SCH-12 | The Today highlight re-evaluates every 60 s. | ✅ |
| FR-SCH-13 | Show a visible notice when a refresh fails but stale data is being shown. Currently the error is swallowed silently. | ⚠️ |
| FR-SCH-14 | Show a stale-data warning when `lastUpdated` is older than a threshold (e.g. > 36 h), since the scraper runs twice daily. | 🔲 |

### 4.4 Business rules (status computation)

Implemented in `PoolTimes.status(now:)` and the `Session`/`Day` extensions.

| ID | Rule | Status |
|---|---|---|
| BR-01 | **Public session** = a session whose `time` is non-empty AND whose name (case-insensitive) contains neither "bulkhead" nor "closed". Only public sessions count toward status and are displayed. | ✅ |
| BR-02 | **Session time** strings are `"h:mm AM - h:mm PM"`. A session with an unparseable range is shown but never counts as active or as a next session. | ✅ |
| BR-03 | **Open** = the current time falls within any public session's range today, **start-inclusive, end-exclusive** (start ≤ now < end, minute resolution). A pool is Closed at its end minute, and back-to-back sessions never both count as active. *Decided 2026-09-30.* | ✅ |
| BR-04 | **Closing time** = the latest end time among *all* today's public sessions (not only the active one). | ✅ |
| BR-05 | **Next opening** = the first public session today starting strictly after now; otherwise the first public session of the next later day in the data that has one. | ✅ |
| BR-06 | **Display rounding**: any displayed time whose minute ends in 9 (`:09`, `:29`, `:59`…) is rounded up one minute (8:59 → 9:00). Rounding affects display only, not status evaluation. | ✅ |
| BR-07 | **Time format**: 12-hour, omit `:00` (`6 AM`, `6:30 PM`). Noon is `12 PM`, midnight `12 AM`. | ✅ |
| BR-08 | Day lookup uses the `yyyy-MM-dd` date key compared with the current date **in America/Vancouver** (see BR-09). | ✅ |
| BR-09 | "Today", the current minute, and the 60 s refresh all evaluate time in **America/Vancouver**, regardless of the device's time zone. This applies to status computation, the Today section, the active-row highlight, and the "Today" header. *Decided 2026-09-30.* | ✅ |
| BR-10 | Sessions that cross midnight (end earlier than start) should be handled. | ⚠️ |

---

## 5. Data and Integration Requirements

| ID | Requirement | Status |
|---|---|---|
| DR-01 | Fetch `https://raw.githubusercontent.com/vipteryx/centretracker/main/data/<activity>/<slug>.json` via `URLSession.shared`. Pool uses activity `pool`. | ✅ |
| DR-02 | Decode the schema in §7. `lastUpdated` is ISO 8601 **with fractional seconds**; any other format is a decoding error. | ✅ |
| DR-03 | `Venue.activityURL(activity:)` is the single place that builds data URLs so future activities (gym, basketball) reuse it. | ✅ |
| DR-04 | Data is held in memory only. No on-disk cache; relaunching offline yields "Unavailable"/"Unable to Load". | ✅ (as-is) |
| DR-05 | HTTP status codes are not checked. A non-200 response (e.g. a 404 HTML body) surfaces as a decoding error with a technical message. | ⚠️ |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Status |
|---|---|---|---|
| NFR-01 | Platform | Minimum iOS 17.0 (uses `@Observable`, regex literals). Liquid Glass styling is automatic on iOS 26; no custom glass code. | ✅ |
| NFR-02 | Performance | List is usable as soon as any venue loads; venues render independently. Status calculation is O(sessions) and runs on the main actor. | ✅ |
| NFR-03 | Concurrency | `ScheduleService` is `@MainActor`; fetches run concurrently via a task group. | ✅ |
| NFR-04 | Appearance | Supports Light and Dark mode using semantic system colours only. | ✅ |
| NFR-05 | Privacy | No analytics, no tracking, no user data collected, no location permission requested (coordinates are fixed constants). | ✅ |
| NFR-06 | Network | All traffic over HTTPS to one host (plus user-initiated Maps links). | ✅ |
| NFR-07 | Accessibility | Use system text styles so Dynamic Type works. Status is conveyed by label text as well as colour. Explicit VoiceOver labels are not set. | ⚠️ |
| NFR-08 | Localization | English only; strings are hard-coded. | ✅ (as-is) |
| NFR-09 | Battery | The 60 s timer runs only while a screen is on-screen (SwiftUI `.task` cancellation) and does no I/O. | ✅ |
| NFR-10 | Testing | No unit tests exist. The status logic in `PoolTimes.swift` is pure and should be covered (see §9). | 🔲 |

---

## 7. Data Contract

`data/pool/<slug>.json`, produced by the scraper:

```json
{
  "lastUpdated": "2026-03-15T19:40:12.123Z",
  "weekRange": { "start": "2026-03-15", "end": "2026-03-21" },
  "days": [
    {
      "date": "2026-03-15",
      "dayOfWeek": "Sunday",
      "sessions": [
        { "name": "Lane Swim", "time": "6:00 AM - 8:00 AM", "location": "Main Pool" }
      ]
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `lastUpdated` | string | ISO 8601 with fractional seconds. Required. |
| `weekRange.start/end` | string | `yyyy-MM-dd`. Required (non-null) by the decoder. |
| `days[].date` | string | `yyyy-MM-dd`. Also the day's identity. |
| `days[].dayOfWeek` | string | Full English name; first 3 letters used as the abbreviation. |
| `sessions[].name` | string | Filtered by BR-01. |
| `sessions[].time` | string | `h:mm AM - h:mm PM`, may be empty. |
| `sessions[].location` | string | May be empty. |

**Compatibility constraint:** the scraper emits `weekRange: { start: null, end: null }` and `days: []` when extraction fails (see `issues.md`). Because `WeekRange` fields are non-optional, such a file currently fails to decode. See OQ-02.

---

## 8. Screen States Matrix

| State | List card | Schedule screen |
|---|---|---|
| Loading, no data | Grey "…" pill | Spinner + "Loading schedule…" |
| Load failed, no data | Grey "Unavailable" | "Unable to Load" view |
| Loaded, open now | Green "Open", closes time, session line | Today list with active row green |
| Loaded, closed, opens later | Red "Closed", "Opens `<label>`" | Today list, no highlight |
| Loaded, closed, nothing ahead | Red "Closed", "No upcoming" | Today "No sessions today" / future "Closed" |
| Loaded, today not in data | Red "Closed", next future opening or "No upcoming" | "Schedule not available — pull to refresh" + all days |
| Refresh failed, stale data | Stale status shown, no notice | Stale list shown, no notice (FR-SCH-13) |

---

## 9. Acceptance Criteria (key scenarios)

1. **Open now** — Given Hillcrest has Lane Swim 6:00 AM–8:00 AM and Public Swim 12:00 PM–8:59 PM today and it is 12:30 PM, the card shows "Open", "8:59 PM" displayed as **9 PM** under "Closes", and "Public Swim · 12 PM - 9 PM".
2. **Between sessions** — At 9:00 AM with the next session at 12:00 PM, the card shows "Closed" and "Opens 12 PM".
3. **After last session** — At 10 PM with tomorrow (Sat) starting 7:00 AM, the card shows "Closed" and "Opens Sat 7 AM".
4. **Bulkhead/closed filtering** — A "Bulkhead" or "Renfrew Pool Closed" session never appears in lists and never makes a pool Open.
5. **Out-of-week** — If today is after the last day in the data, every card shows "Closed" / "No upcoming" and the schedule screen shows the "Schedule not available" message.
6. **Partial failure** — With one venue's file returning 404, the other seven cards render normally and the failed one shows "Unavailable".
7. **Live flip** — With the app foregrounded across a session boundary, the card changes state within 60 s without user action.
8. **Directions** — Choosing Apple Maps or Google Maps opens the respective app/site with the venue as destination.
9. **Pull-to-refresh** — On the schedule screen, pulling down re-fetches and updates the "Updated …" footer.

Suggested unit-test seams (pure functions, no network): `Session.isPublic`, `parsedTimeRange`, `formatSessionMinutes` rounding, `Day.isOpen`, `Day.closingTimeLabel`, `PoolTimes.status(now:)` for scenarios 1–5.

---

## 10. Known Gaps and Open Questions

| # | Item | Impact |
|---|---|---|
| ~~OQ-01~~ | **Time zone** — *Resolved 2026-09-30:* pin to `America/Vancouver` (BR-08, BR-09). Implemented. | Medium |
| OQ-02 | **Empty-schedule files** (§7): null `weekRange` makes decoding fail → "Unavailable". Either make `WeekRange` optional or accept the current behaviour. | Medium |
| ~~OQ-03~~ | **Boundary inclusivity** — *Resolved 2026-09-30:* end-exclusive (BR-03). Implemented. | Low |
| OQ-04 | **Session identity**: `Session.id = name + time`. Two same-named, same-time sessions in different locations collide in SwiftUI `ForEach`. Include `location` in the ID. | Low |
| OQ-05 | **Closing time semantics** (BR-04): uses the last session of the day even if a gap exists between sessions. Is "Closes 9 PM" correct when there is a mid-day break after the active session? | Low |
| OQ-06 | **Staleness UX** (FR-SCH-13/14, FR-LIST-11): no indication when data is old or a refresh failed. | Medium |
| OQ-07 | **Offline cache** (DR-04): consider persisting last good JSON for instant launch and offline use. | Medium |
| OQ-08 | **Hard-coded raw-GitHub URL** ties the app to the repo owner/branch; renaming the repo breaks shipped versions. | Low |

---

## 11. Change Log

| Date (UTC) | Version | Change |
|---|---|---|
| 2026-09-30 | 1.0 | Initial FRD reverse-documented from the shipped iOS source. |
| 2026-09-30 | 1.1 | Decisions: pin all time evaluation to America/Vancouver (BR-08/09, OQ-01 resolved); make session end time exclusive (BR-03, OQ-03 resolved). Code changes pending. |
| 2026-09-30 | 1.2 | Implemented BR-03 (end-exclusive) and BR-08/BR-09 (America/Vancouver) in `PoolTimes.swift` / `VenueScheduleView.swift`. |

*Maintenance rule: when iOS behaviour changes, update the affected requirement rows and status markers, add a row here, bump the version, and keep [ios-app.md](ios-app.md) consistent.*
