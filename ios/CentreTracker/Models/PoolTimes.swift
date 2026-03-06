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
