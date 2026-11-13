import Foundation

struct PoolTimes: Codable {
    let lastUpdated: Date
    let weekRange: WeekRange
    let days: [Day]
}

struct WeekRange: Codable {
    let start: String
    let end: String
}

struct Day: Codable, Identifiable {
    var id: String { date }
    let date: String
    let dayOfWeek: String
    let sessions: [Session]
}

struct Session: Codable, Identifiable {
    var id: String { name + time }
    let name: String
    let time: String
    let location: String
}

// MARK: - Session kinds

/// What a session lets you do. Only Lengths and Public swim make a venue open.
enum SessionKind: CaseIterable {
    case lengths
    case publicSwim
    case other

    /// Classifies by name, case-insensitive, first match wins.
    init(name: String) {
        let lower = name.lowercased()
        if lower.contains("length") || lower.contains("one lane") {
            self = .lengths
        } else if lower.contains("public") || lower.contains("free swim") {
            self = .publicSwim
        } else {
            self = .other
        }
    }

    var label: String {
        switch self {
        case .lengths:    return "Lengths"
        case .publicSwim: return "Public swim"
        case .other:      return "Other"
        }
    }

    var isSwimmable: Bool { self != .other }
}

// MARK: - Status type

/// A kind of swimming that is on now, and when its current run of sessions ends.
struct ActiveRun: Equatable {
    let kind: SessionKind
    let endMinutes: Int
    var untilLabel: String { formatSessionMinutes(endMinutes) }
}

enum PoolStatus: Equatable {
    /// Lengths and/or public swim are on now; one run per kind, Lengths first.
    case open([ActiveRun])
    /// Nothing swimmable on now; nextLabel is "6 AM" (later today) or "Mon 6 AM" (future day).
    case closed(nextLabel: String?)
    /// The scraped week no longer covers today.
    case outOfDate
    /// Data not loaded.
    case unknown
}

// MARK: - Session extensions

extension Session {
    /// Shown in the schedule: excludes sessions with empty time, "bulkhead" or "closed" in name.
    var isListed: Bool {
        let lower = name.lowercased()
        return !time.isEmpty && !lower.contains("bulkhead") && !lower.contains("closed")
    }

    var kind: SessionKind { SessionKind(name: name) }

    /// Parses "6:00 AM - 8:00 AM" → (start, end) minutes since midnight.
    /// Returns nil for empty or malformed time strings.
    var parsedTimeRange: (start: Int, end: Int)? {
        let parts = time.components(separatedBy: " - ")
        guard parts.count == 2,
              let start = parseSessionTime(parts[0].trimmingCharacters(in: .whitespaces)),
              let end = parseSessionTime(parts[1].trimmingCharacters(in: .whitespaces))
        else { return nil }
        return (start, end)
    }

    func isActive(at nowMinutes: Int) -> Bool {
        guard let r = parsedTimeRange else { return false }
        return nowMinutes >= r.start && nowMinutes <= r.end
    }

    /// The start-time portion only, rounded for display, e.g. "6:00 AM"
    var startTimeLabel: String {
        let raw = time.components(separatedBy: " - ").first?.trimmingCharacters(in: .whitespaces) ?? time
        guard let minutes = parseSessionTime(raw) else { return raw }
        return formatSessionMinutes(minutes)
    }

    /// The end-time portion only, rounded for display, e.g. "8:00 AM"
    var endTimeLabel: String {
        let raw = time.components(separatedBy: " - ").last?.trimmingCharacters(in: .whitespaces) ?? time
        guard let minutes = parseSessionTime(raw) else { return raw }
        return formatSessionMinutes(minutes)
    }
}

// MARK: - Day extensions

extension Day {
    var listedSessions: [Session] { sessions.filter(\.isListed) }

    private var swimmableRanges: [(kind: SessionKind, start: Int, end: Int)] {
        listedSessions.compactMap { s in
            guard s.kind.isSwimmable, let r = s.parsedTimeRange else { return nil }
            return (s.kind, r.start, r.end)
        }
    }

    /// For each swimmable kind on now, the end of its current run: sessions of that
    /// kind that overlap or follow on within a minute (e.g. 10:59 → 11:00) are merged.
    func activeRuns(at nowMinutes: Int) -> [ActiveRun] {
        SessionKind.allCases.filter(\.isSwimmable).compactMap { kind in
            let ranges = swimmableRanges.filter { $0.kind == kind }.sorted { $0.start < $1.start }
            guard ranges.contains(where: { nowMinutes >= $0.start && nowMinutes <= $0.end }) else { return nil }
            var end = nowMinutes
            var extended = true
            while extended {
                extended = false
                for r in ranges where r.start <= end + 1 && r.end > end {
                    end = r.end
                    extended = true
                }
            }
            return ActiveRun(kind: kind, endMinutes: end)
        }
    }

    /// Earliest start of a swimmable session strictly after nowMinutes.
    func nextSwimmableStart(after nowMinutes: Int) -> Int? {
        swimmableRanges.map(\.start).filter { $0 > nowMinutes }.min()
    }
}

// MARK: - PoolTimes extensions

private func dayKey(_ date: Date) -> String {
    let fmt = DateFormatter()
    fmt.calendar = Calendar(identifier: .gregorian)
    fmt.locale = Locale(identifier: "en_US_POSIX")
    fmt.dateFormat = "yyyy-MM-dd"
    return fmt.string(from: date)
}

extension PoolTimes {
    func today(for date: Date = .now) -> Day? {
        let key = dayKey(date)
        return days.first { $0.date == key }
    }

    func status(now: Date = .now) -> PoolStatus {
        let cal = Calendar.current
        let nowMinutes = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        let todayKey = dayKey(now)

        guard let todayIndex = days.firstIndex(where: { $0.date == todayKey }) else {
            // Today isn't in the data. If the whole week is still ahead, point at it;
            // otherwise the data is stale.
            guard !days.isEmpty, days.allSatisfy({ $0.date > todayKey }) else { return .outOfDate }
            return .closed(nextLabel: nextOpening(in: days[...]))
        }

        let today = days[todayIndex]
        let runs = today.activeRuns(at: nowMinutes)
        if !runs.isEmpty { return .open(runs) }

        if let next = today.nextSwimmableStart(after: nowMinutes) {
            return .closed(nextLabel: formatSessionMinutes(next))
        }
        return .closed(nextLabel: nextOpening(in: days[(todayIndex + 1)...]))
    }

    /// "Mon 6 AM" for the first future day with a swimmable session.
    private func nextOpening(in futureDays: ArraySlice<Day>) -> String? {
        for day in futureDays {
            if let start = day.nextSwimmableStart(after: -1) {
                return "\(day.dayOfWeek.prefix(3)) \(formatSessionMinutes(start))"
            }
        }
        return nil
    }
}

// MARK: - Private parsing helpers

/// Rounds up times ending in :X9 (e.g. 8:59 → 9:00, 9:29 → 9:30)
private func roundMinutes(_ m: Int) -> Int {
    m % 10 == 9 ? m + 1 : m
}

private func parseSessionTime(_ s: String) -> Int? {
    let pattern = /(\d{1,2}):(\d{2})\s*(AM|PM)/
    guard let match = s.firstMatch(of: pattern) else { return nil }
    var hours = Int(match.1)!
    let minutes = Int(match.2)!
    let period = String(match.3)
    if period == "PM" && hours != 12 { hours += 12 }
    if period == "AM" && hours == 12 { hours = 0 }
    return hours * 60 + minutes
}

func formatSessionMinutes(_ totalMinutes: Int) -> String {
    let total = roundMinutes(totalMinutes)
    let h = total / 60
    let m = total % 60
    let period = h >= 12 ? "PM" : "AM"
    let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
    if m == 0 {
        return "\(h12) \(period)"
    } else {
        return String(format: "%d:%02d %@", h12, m, period)
    }
}
