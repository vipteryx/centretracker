import Foundation

enum Venue: String, CaseIterable, Identifiable {
    case hillcrest
    case britannia
    case aquatic
    case templeton
    case renfrew
    case kensington
    case killarney
    case lordByng

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .hillcrest:   return "Hillcrest"
        case .britannia:   return "Britannia"
        case .aquatic:     return "Vancouver Aquatic Centre"
        case .templeton:   return "Templeton"
        case .renfrew:     return "Renfrew"
        case .kensington:  return "Kensington"
        case .killarney:   return "Killarney"
        case .lordByng:    return "Lord Byng"
        }
    }

    private var slug: String {
        switch self {
        case .hillcrest:   return "hillcrest"
        case .britannia:   return "britannia"
        case .aquatic:     return "aquatic"
        case .templeton:   return "templeton"
        case .renfrew:     return "renfrew"
        case .kensington:  return "kensington"
        case .killarney:   return "killarney"
        case .lordByng:    return "lord-byng"
        }
    }

    func activityURL(activity: String) -> URL {
        URL(string: "https://raw.githubusercontent.com/vipteryx/centretracker/main/data/\(activity)/\(slug).json")!
    }

    var poolTimesURL: URL { activityURL(activity: "pool") }
}
