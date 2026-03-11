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

// MARK: - Status type

enum PoolStatus {
    /// Pool is open; closingTime is end of last public session today
    case open(closingTime: String, sessionName: String)
    /// Pool is closed; nextLabel is "6:00 AM" (later today) or "Mon 6:00 AM" (future day)
    case closed(nextLabel: String?)
    /// Today is not in the scraped week or data not loaded
    case unknown
}

// MARK: - Session extensions

extension Session {
    /// Matches webapp: excludes sessions with empty time or "bulkhead" in name
    var isPublic: Bool {
        !time.isEmpty && !name.lowercased().contains("bulkhead")
    }

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

    /// The start-time portion only, e.g. "6:00 AM"
    var startTimeLabel: String {
        time.components(separatedBy: " - ").first?.trimmingCharacters(in: .whitespaces) ?? time
    }
}

// MARK: - Day extensions

extension Day {
    var publicSessions: [Session] { sessions.filter(\.isPublic) }

    func isOpen(at nowMinutes: Int) -> Bool {
        publicSessions.contains { $0.isActive(at: nowMinutes) }
    }

    /// End time of the last public session today, e.g. "8:00 PM"
    func closingTimeLabel() -> String? {
        publicSessions
            .compactMap { $0.parsedTimeRange?.end }
            .max()
            .map { formatSessionMinutes($0) }
    }

    /// First public session starting strictly after nowMinutes
    func nextSessionAfter(_ nowMinutes: Int) -> Session? {
        publicSessions.first { ($0.parsedTimeRange?.start ?? Int.max) > nowMinutes }
    }
}

// MARK: - PoolTimes extensions

extension PoolTimes {
    func today(for date: Date = .now) -> Day? {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let key = fmt.string(from: date)
        return days.first { $0.date == key }
    }

    func status(now: Date = .now) -> PoolStatus {
        let cal = Calendar.current
        let nowMinutes = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let todayKey = fmt.string(from: now)

        guard let todayIndex = days.firstIndex(where: { $0.date == todayKey }) else {
            return .unknown
        }

        let today = days[todayIndex]

        if today.isOpen(at: nowMinutes) {
            let closing = today.closingTimeLabel() ?? ""
            let sessionName = today.publicSessions.first { $0.isActive(at: nowMinutes) }?.name ?? ""
            return .open(closingTime: closing, sessionName: sessionName)
        }

        // Check if there's a session later today
        if let next = today.nextSessionAfter(nowMinutes) {
            return .closed(nextLabel: next.startTimeLabel)
        }

        // Search future days in the scraped week
        for day in days[(todayIndex + 1)...] {
            if let first = day.publicSessions.first {
                let abbrev = String(day.dayOfWeek.prefix(3))
                return .closed(nextLabel: "\(abbrev) \(first.startTimeLabel)")
            }
        }

        return .closed(nextLabel: nil)
    }
}

// MARK: - Private parsing helpers

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

private func formatSessionMinutes(_ totalMinutes: Int) -> String {
    let h = totalMinutes / 60
    let m = totalMinutes % 60
    let period = h >= 12 ? "PM" : "AM"
    let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
    if m == 0 {
        return "\(h12) \(period)"
    } else {
        return String(format: "%d:%02d %@", h12, m, period)
    }
}
