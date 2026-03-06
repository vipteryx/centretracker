import SwiftUI

struct SessionRowView: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(session.name)
                .font(.body)
                .fontWeight(.medium)
            HStack {
                Text(session.time)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(session.location)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }
}
