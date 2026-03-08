# iOS App — Feature Reference

**Location:** `ios/CentreTracker/`
**Language:** Swift
**UI framework:** SwiftUI
**Minimum deployment target:** iOS 17+

---

## Overview

A native SwiftUI companion app that reads pool schedule JSON directly from the GitHub repository and displays the weekly session schedule for each of the 8 monitored community centre pools.

There is no backend or dedicated API — the app fetches the same JSON files that the web app uses, served via GitHub's raw content CDN.

---

## Venue Model (`Venue.swift`)

`Venue` is a Swift enum that represents all 8 community centres.

```swift
enum Venue: String, CaseIterable, Identifiable { ... }
```

### Cases

| Case | Display Name |
|---|---|
| `hillcrest` | Hillcrest |
| `britannia` | Britannia |
| `aquatic` | Vancouver Aquatic Centre |
| `templeton` | Templeton |
| `renfrew` | Renfrew |
| `kensington` | Kensington |
| `killarney` | Killarney |
| `lordByng` | Lord Byng |

### Protocol Conformances

- **`CaseIterable`** — allows the app to iterate all venues automatically (e.g., `Venue.allCases` to build a list).
- **`Identifiable`** — allows SwiftUI `List` and `ForEach` to use a `Venue` value directly as a list item without a separate `id` parameter.
- **`String` raw value** — stores the internal identifier for each case.

### `displayName`

A computed property that returns the human-readable name shown in the UI (e.g., `"Vancouver Aquatic Centre"`, `"Lord Byng"`).

### `slug` (private)

Maps enum cases to the hyphenated filename slugs used in data URLs:

| Case | Slug |
|---|---|
| `lordByng` | `"lord-byng"` |
| `aquatic` | `"aquatic"` |
| All others | Same as raw value |

### `activityURL(activity:)`

Constructs the URL to a venue's JSON data file on GitHub:

```swift
func activityURL(activity: String) -> URL {
    URL(string: "https://raw.githubusercontent.com/vipteryx/centretracker/main/data/\(activity)/\(slug).json")!
}
```

The `activity` parameter makes this method extensible to future activity types:

| Call | Example URL |
|---|---|
| `activityURL(activity: "pool")` | `.../data/pool/hillcrest.json` |
| `activityURL(activity: "gym")` | `.../data/gym/hillcrest.json` |
| `activityURL(activity: "basketball")` | `.../data/basketball/hillcrest.json` |

### `poolTimesURL`

A convenience property that calls `activityURL(activity: "pool")`. This is the URL used by the network layer to fetch pool schedule data.

---

## Codable Data Models (`PoolTimes`)

These `Codable` structs map directly to the JSON schema produced by the scraper.

### `PoolTimes`

```swift
struct PoolTimes: Codable {
    let lastUpdated: String
    let weekRange: WeekRange
    let days: [Day]
}
```

### `WeekRange`

```swift
struct WeekRange: Codable {
    let start: String
    let end: String
}
```

### `Day`

```swift
struct Day: Codable {
    let date: String
    let dayOfWeek: String
    let sessions: [Session]
}
```

### `Session`

```swift
struct Session: Codable {
    let name: String
    let time: String
    let location: String?
    let status: String?
}
```

`location` and `status` are optional because not all sessions in the source data include them.

---

## Network Layer (`ScheduleService`)

`ScheduleService` is responsible for fetching and decoding schedule JSON.

- Uses Swift's `URLSession` with `async/await`.
- Calls `poolTimesURL` on the provided `Venue` to build the request URL.
- Decodes the response body into a `PoolTimes` struct using `JSONDecoder`.
- Throws on network errors or decoding failures; callers handle errors via `do/catch` or `.task { }`.

---

## SwiftUI Views

### `VenueListView`

The root view of the app. Displays a `List` of all 8 venues using `Venue.allCases`. Tapping a venue navigates to `VenueScheduleView` for that venue.

### `VenueScheduleView`

Displays the full weekly pool schedule for a selected venue.

- Calls `ScheduleService` in a `.task` modifier when the view appears.
- Shows a loading indicator while the fetch is in progress.
- Shows an error message if the fetch fails.
- On success, renders a section per day using the `days` array from `PoolTimes`.
- Each section header shows the day of the week and date; each row is a `SessionRowView`.

### `SessionRowView`

Renders a single pool session as a horizontal row:

- Left side: session time (e.g., `"6:00 AM - 8:29 AM"`)
- Right side: session name (e.g., `"Length Swim (3 lanes x 25m)"`)
- Optional location subtitle if `location` is present

---

## Data Source

The iOS app reads JSON from GitHub's raw content CDN:

```
https://raw.githubusercontent.com/vipteryx/centretracker/main/data/pool/<venue>.json
```

The files are updated by the GitHub Actions CI workflow twice daily (02:00 and 14:00 UTC) and committed back to the repository. The iOS app always fetches the latest committed version.

No authentication is required — the repository is public.

---

## Extensibility

Adding a new activity type (e.g., gym hours) requires no changes to the `Venue` model:

```swift
// Fetch gym data for any venue:
let url = venue.activityURL(activity: "gym")
```

Adding a new venue requires:
1. A new case in the `Venue` enum.
2. An entry in `displayName`.
3. A slug entry in `slug` (if it differs from the raw value).
