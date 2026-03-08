import Foundation

@Observable
@MainActor
final class ScheduleService {
    private(set) var poolTimes: PoolTimes?
    private(set) var isLoading = false
    private(set) var error: Error?

    private let venue: Venue
    private static var cache: [String: PoolTimes] = [:]

    init(venue: Venue) {
        self.venue = venue
    }

    func load() async {
        isLoading = true
        error = nil
        do {
            let fetched = try await fetch()
            // Cache keyed by venue + lastUpdated to avoid redundant decodes
            let cacheKey = venue.id + fetched.lastUpdated.description
            Self.cache[cacheKey] = fetched
            poolTimes = fetched
        } catch {
            self.error = error
        }
        isLoading = false
    }

    private func fetch() async throws -> PoolTimes {
        let (data, _) = try await URLSession.shared.data(from: venue.poolTimesURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            guard let date = formatter.date(from: str) else {
                throw DecodingError.dataCorrupted(
                    DecodingError.Context(
                        codingPath: decoder.codingPath,
                        debugDescription: "Invalid ISO 8601 date: \(str)"
                    )
                )
            }
            return date
        }
        return try decoder.decode(PoolTimes.self, from: data)
    }
}
