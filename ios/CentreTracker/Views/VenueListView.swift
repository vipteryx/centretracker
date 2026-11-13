import SwiftUI

struct VenueListView: View {
    @State private var services = Dictionary(
        uniqueKeysWithValues: Venue.allCases.map { ($0, ScheduleService(venue: $0)) }
    )
    @State private var now: Date = .now

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(Venue.allCases) { venue in
                        NavigationLink(value: venue) {
                            VenueCardRow(
                                venue: venue,
                                service: services[venue]!,
                                now: now
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    if let updated = oldestUpdate {
                        Text("Updated \(updated.formatted(.relative(presentation: .named)))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.top, 4)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Vancouver Pools")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: Venue.self) { venue in
                VenueScheduleView(venue: venue)
            }
        }
        .task { await loadAll() }
        .task {
            while true {
                try? await Task.sleep(for: .seconds(60))
                now = .now
            }
        }
    }

    /// Oldest scrape time across loaded venues, so the footer never overstates freshness.
    private var oldestUpdate: Date? {
        services.values.compactMap { $0.poolTimes?.lastUpdated }.min()
    }

    private func loadAll() async {
        await withTaskGroup(of: Void.self) { group in
            for (_, service) in services {
                group.addTask { await service.load() }
            }
        }
    }
}

// MARK: - Venue Card Row

private struct VenueCardRow: View {
    let venue: Venue
    let service: ScheduleService
    let now: Date

    private var status: PoolStatus {
        service.poolTimes?.status(now: now) ?? .unknown
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(venue.displayName)
                    .font(.headline)
                    .foregroundStyle(.primary)
                if case .open(let runs) = displayStatus {
                    ForEach(runs, id: \.kind) { run in
                        RunLine(run: run)
                    }
                } else {
                    statusBadge
                }
            }
            Spacer()
            nextOpening
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// Status to draw, or nil while loading / after a failed first load.
    private var displayStatus: PoolStatus? {
        guard service.poolTimes != nil else { return nil }
        return status
    }

    @ViewBuilder
    private var statusBadge: some View {
        if service.isLoading && service.poolTimes == nil {
            StatusPill(label: "…", color: .secondary)
        } else if service.error != nil && service.poolTimes == nil {
            StatusPill(label: "Unavailable", color: .secondary)
        } else {
            switch status {
            case .open:
                EmptyView()
            case .closed:
                StatusPill(label: "Closed", color: .red)
            case .outOfDate:
                StatusPill(label: "Out of date", color: .orange)
            case .unknown:
                StatusPill(label: "Unknown", color: .secondary)
            }
        }
    }

    @ViewBuilder
    private var nextOpening: some View {
        if case .closed(let nextLabel) = displayStatus {
            if let label = nextLabel {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(label)
                        .font(.callout.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("Opens")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("No upcoming")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Run line

/// "● Lengths until 9 PM"
private struct RunLine: View {
    let run: ActiveRun

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color.green)
                .frame(width: 8, height: 8)
            Text(run.kind.label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            Text("until \(run.untilLabel)")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Status Pill

private struct StatusPill: View {
    let label: String
    let color: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.15)))
    }
}

#Preview {
    VenueListView()
}
