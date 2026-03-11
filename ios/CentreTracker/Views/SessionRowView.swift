import SwiftUI

struct SessionRowView: View {
    let session: Session
    var isActive: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Text(session.startTimeLabel)
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(isActive ? Color.green : .secondary)
                .frame(minWidth: 72, alignment: .leading)
            Text(session.name)
                .font(.body)
                .fontWeight(isActive ? .semibold : .regular)
                .foregroundStyle(isActive ? Color.green : .primary)
            Spacer()
            if !session.location.isEmpty {
                Text(session.location)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }
}
