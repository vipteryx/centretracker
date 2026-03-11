import SwiftUI

struct VenueScheduleView: View {
    let venue: Venue
    @State private var service: ScheduleService
    @State private var now: Date = .now

    init(venue: Venue) {
        self.venue = venue
        self._service = State(initialValue: ScheduleService(venue: venue))
    }

    private var nowMinutes: Int {
        let c = Calendar.current
        return c.component(.hour, from: now) * 60 + c.component(.minute, from: now)
    }

    private var todayKey: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: now)
    }

    var body: some View {
        ZStack {
            poolBackground
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
                    scheduleList(poolTimes)
                }
            }
        }
        .navigationTitle(venue.displayName)
        .navigationBarTitleDisplayMode(.large)
        .task { await service.load() }
        .task {
            while true {
                try? await Task.sleep(for: .seconds(60))
                now = .now
            }
        }
    }

    @ViewBuilder
    private func scheduleList(_ poolTimes: PoolTimes) -> some View {
        let todayDay = poolTimes.today(for: now)
        let futureDays: [Day] = {
            guard let idx = poolTimes.days.firstIndex(where: { $0.date == todayKey }) else {
                return poolTimes.days
            }
            return Array(poolTimes.days[(idx + 1)...])
        }()

        List {
            // Today section
            Section {
                if let today = todayDay {
                    let sessions = today.publicSessions
                    if sessions.isEmpty {
                        Text("No sessions today")
                            .foregroundStyle(.secondary)
                            .italic()
                    } else {
                        ForEach(sessions) { session in
                            SessionRowView(
                                session: session,
                                isActive: session.isActive(at: nowMinutes)
                            )
                        }
                    }
                } else {
                    Text("Schedule not available — pull to refresh")
                        .foregroundStyle(.secondary)
                        .italic()
                }
            } header: {
                if let today = todayDay {
                    Text("Today · \(today.dayOfWeek), \(formatDate(today.date))")
                        .foregroundStyle(.tint)
                        .fontWeight(.semibold)
                        .textCase(nil)
                } else {
                    Text("Today")
                        .foregroundStyle(.tint)
                        .fontWeight(.semibold)
                        .textCase(nil)
                }
            }

            // Remaining days
            ForEach(futureDays) { day in
                let sessions = day.publicSessions
                Section {
                    if sessions.isEmpty {
                        Text("Closed")
                            .foregroundStyle(.secondary)
                            .italic()
                    } else {
                        ForEach(sessions) { session in
                            SessionRowView(session: session)
                        }
                    }
                } header: {
                    Text("\(day.dayOfWeek), \(formatDate(day.date))")
                        .textCase(nil)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await service.load() }
        .safeAreaInset(edge: .bottom) {
            Text("Updated \(poolTimes.lastUpdated.formatted(.relative(presentation: .named)))")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.vertical, 8)
        }
    }

    private func formatDate(_ dateString: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        let display = DateFormatter()
        display.dateFormat = "MMM d"
        guard let date = parser.date(from: dateString) else { return dateString }
        return display.string(from: date)
    }
}
