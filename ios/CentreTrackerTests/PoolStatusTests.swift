import XCTest
@testable import CentreTracker

final class PoolStatusTests: XCTestCase {

    // MARK: - Helpers

    /// A local date/time on the given ISO day, e.g. at("2026-11-12", 16, 0).
    private func at(_ day: String, _ hour: Int, _ minute: Int = 0) -> Date {
        let parts = day.split(separator: "-").map { Int($0)! }
        var c = DateComponents()
        c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
        c.hour = hour; c.minute = minute
        return Calendar.current.date(from: c)!
    }

    private func s(_ name: String, _ time: String) -> Session {
        Session(name: name, time: time, location: "")
    }

    private func week(_ days: [(String, String, [Session])]) -> PoolTimes {
        PoolTimes(
            lastUpdated: .now,
            weekRange: WeekRange(start: days.first?.0 ?? "", end: days.last?.0 ?? ""),
            days: days.map { Day(date: $0.0, dayOfWeek: $0.1, sessions: $0.2) }
        )
    }

    private func runs(_ status: PoolStatus) -> [String] {
        guard case .open(let runs) = status else { return [] }
        return runs.map { "\($0.kind.label) until \($0.untilLabel)" }
    }

    // MARK: - R2.1 classification

    func testClassifiesEveryCurrentSessionName() {
        let lengths = ["Lengths", "Lengths Swim", "Length Swim (25m)", "Length Swim (50m)",
                       "Length Swim (2 lanes x 25m)", "Lengths with Tot Pool", "Lessons and One Lane"]
        let publicSwim = ["Public Swim", "Evening Public Swim", "Public Swim with Tot Pool",
                          "Public Swim-Leisure Pool", "Public Swim -- Main Tank", "Public Swim - Teach Pool",
                          "Public Swim/ Lessons", "Free Swim"]
        let other = ["Lessons", "Lessons (1 Lane only)", "Weekday Lessons", "Weekend Lessons", "Tot Pool Only",
                     "Dive Tank", "Water Slide or Diving Platform", "Aquafit - Shallow Moderate",
                     "Sauna and Whirlpool Only", "Lessons/Swim Club", "Kayak Practice", "School Board",
                     "Statutory Holiday"]
        for n in lengths { XCTAssertEqual(SessionKind(name: n), .lengths, n) }
        for n in publicSwim { XCTAssertEqual(SessionKind(name: n), .publicSwim, n) }
        for n in other { XCTAssertEqual(SessionKind(name: n), .other, n) }
    }

    // MARK: - R2.2 open means swimmable

    /// Britannia, Thu 2026-11-12, as scraped.
    private var britannia: PoolTimes {
        week([("2026-11-12", "Thursday", [
            s("Lengths", "6:30 AM - 9:59 AM"),
            s("Public Swim", "10:00 AM - 11:29 AM"),
            s("Lengths", "11:30 AM - 12:59 PM"),
            s("Public Swim with Tot Pool", "1:00 PM - 3:59 PM"),
            s("Lessons and One Lane", "4:00 PM - 6:29 PM"),
            s("Public Swim with Tot Pool", "6:30 PM - 7:59 PM"),
            s("Lengths", "8:00 PM - 8:59 PM"),
        ])])
    }

    func testBritanniaLessonsAndOneLaneCountsAsLengths() {
        XCTAssertEqual(runs(britannia.status(now: at("2026-11-12", 16, 56))), ["Lengths until 6:30 PM"])
    }

    func testLessonsOnlyIsNotOpen() {
        let pool = week([("2026-11-12", "Thursday", [
            s("Weekday Lessons", "4:00 PM - 7:59 PM"),
            s("Evening Public Swim", "8:00 PM - 9:29 PM"),
        ])])
        XCTAssertEqual(pool.status(now: at("2026-11-12", 17)), .closed(nextLabel: "8 PM"))
    }

    func testBulkheadAndClosedSessionsIgnored() {
        let pool = week([("2026-11-12", "Thursday", [
            s("Lengths - Bulkhead", "6:00 AM - 8:59 AM"),
            s("Pool Closed", "6:00 AM - 8:59 AM"),
        ])])
        XCTAssertEqual(pool.status(now: at("2026-11-12", 7)), .closed(nextLabel: nil))
    }

    // MARK: - R2.3 run ends

    func testUntilIsEndOfCurrentRunNotLastSessionOfDay() {
        // Morning Lengths, then a gap in Lengths until 11:30.
        XCTAssertEqual(runs(britannia.status(now: at("2026-11-12", 7))), ["Lengths until 10 AM"])
    }

    func testUntilAcrossAfternoonGap() {
        let pool = week([("2026-11-12", "Thursday", [
            s("Public Swim", "9:00 AM - 11:59 AM"),
            s("Public Swim", "3:00 PM - 8:59 PM"),
        ])])
        XCTAssertEqual(runs(pool.status(now: at("2026-11-12", 10))), ["Public swim until 12 PM"])
        XCTAssertEqual(pool.status(now: at("2026-11-12", 13)), .closed(nextLabel: "3 PM"))
    }

    func testBackToBackAndOverlappingSessionsMerge() {
        let pool = week([("2026-11-12", "Thursday", [
            s("Public Swim", "9:00 AM - 10:59 AM"),
            s("Public Swim/ Lessons", "11:00 AM - 12:59 PM"),
            s("Public Swim", "12:30 PM - 4:29 PM"),
        ])])
        XCTAssertEqual(runs(pool.status(now: at("2026-11-12", 9, 30))), ["Public swim until 4:30 PM"])
    }

    func testConcurrentKindsBothShownLengthsFirst() {
        let pool = week([("2026-11-12", "Thursday", [
            s("Public Swim", "9:30 AM - 8:59 PM"),
            s("Length Swim (25m)", "6:00 AM - 8:59 PM"),
        ])])
        XCTAssertEqual(runs(pool.status(now: at("2026-11-12", 16, 56))),
                       ["Lengths until 9 PM", "Public swim until 9 PM"])
    }

    func testNextOpeningUsesEarliestStartNotListOrder() {
        let pool = week([
            ("2026-11-12", "Thursday", [s("Lengths", "6:00 AM - 8:59 AM")]),
            ("2026-11-13", "Friday", [
                s("Public Swim", "10:00 AM - 11:59 AM"),
                s("Lengths", "6:30 AM - 8:59 AM"),
            ]),
        ])
        XCTAssertEqual(pool.status(now: at("2026-11-12", 21)), .closed(nextLabel: "Fri 6:30 AM"))
    }

    // MARK: - R2.5 stale data

    func testWeekInPastIsOutOfDate() {
        let pool = week([("2026-11-01", "Sunday", [s("Lengths", "6:00 AM - 8:59 PM")])])
        XCTAssertEqual(pool.status(now: at("2026-11-12", 10)), .outOfDate)
    }

    func testEmptyDataIsOutOfDate() {
        XCTAssertEqual(week([]).status(now: at("2026-11-12", 10)), .outOfDate)
    }

    func testWeekEntirelyAheadPointsAtFirstOpening() {
        let pool = week([("2026-11-16", "Monday", [s("Lengths", "6:00 AM - 8:59 PM")])])
        XCTAssertEqual(pool.status(now: at("2026-11-15", 22)), .closed(nextLabel: "Mon 6 AM"))
    }
}
