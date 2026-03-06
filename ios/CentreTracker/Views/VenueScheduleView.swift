import SwiftUI

struct VenueScheduleView: View {
    let venue: Venue
    @State private var service: ScheduleService

    init(venue: Venue) {
        self.venue = venue
        self._service = State(initialValue: ScheduleService(venue: venue))
    }

    var body: some View {
        Group {
            if service.isLoading && service.poolTimes == nil {
                ProgressView("Loading schedule…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = service.error, service.poolTimes == nil {
                ContentUnavailableView(
                    "Unable to Load",
                    systemImage: "wifi.slash",
                    description: Text(error.localizedDescription)
                )
            } else if let poolTimes = service.poolTimes {
                List {
                    Section {
                        weekRangeHeader(poolTimes)
                    }
                    ForEach(poolTimes.days) { day in
                        Section(header: Text("\(day.dayOfWeek) · \(day.date)")) {
                            if day.sessions.isEmpty {
                                Text("No sessions scheduled")
                                    .foregroundStyle(.secondary)
                                    .italic()
                            } else {
                                ForEach(day.sessions) { session in
                                    SessionRowView(session: session)
                                }
                            }
                        }
                    }
                }
                .refreshable {
                    await service.load()
                }
            }
        }
        .navigationTitle(venue.displayName)
        .navigationBarTitleDisplayMode(.large)
        .task {
            await service.load()
        }
    }

    @ViewBuilder
    private func weekRangeHeader(_ poolTimes: PoolTimes) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Week of \(poolTimes.weekRange.start) – \(poolTimes.weekRange.end)")
                .font(.headline)
            Text("Updated \(poolTimes.lastUpdated.formatted(.relative(presentation: .named)))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
