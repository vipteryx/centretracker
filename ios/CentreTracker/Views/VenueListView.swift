import SwiftUI

struct VenueListView: View {
    var body: some View {
        NavigationStack {
            List(Venue.allCases) { venue in
                NavigationLink(venue.displayName, value: venue)
            }
            .navigationTitle("Pool Schedules")
            .navigationDestination(for: Venue.self) { venue in
                VenueScheduleView(venue: venue)
            }
        }
    }
}

#Preview {
    VenueListView()
}
