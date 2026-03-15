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
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(venue.displayName)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    statusBadge
                }
                Spacer()
                timeInfo
            }
            if case .open(_, let sessionName, let sessionTime) = status, !sessionName.isEmpty {
                Text("\(sessionName) · \(sessionTime)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                StatusPill(label: "Open", color: .green)
            case .closed:
                StatusPill(label: "Closed", color: .red)
            case .unknown:
                StatusPill(label: "Unknown", color: .secondary)
            }
        }
    }

    @ViewBuilder
    private var timeInfo: some View {
        switch status {
        case .open(let closingTime, _, _):
            VStack(alignment: .trailing, spacing: 2) {
                Text(closingTime)
                    .font(.callout.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.green)
                Text("Closes")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        case .closed(let nextLabel):
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
        case .unknown:
            EmptyView()
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
