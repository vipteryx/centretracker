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

    private var jsonFileName: String {
        switch self {
        case .hillcrest:   return "hillcrest-pool-times.json"
        case .britannia:   return "britannia-pool-times.json"
        case .aquatic:     return "aquatic-pool-times.json"
        case .templeton:   return "templeton-pool-times.json"
        case .renfrew:     return "renfrew-pool-times.json"
        case .kensington:  return "kensington-pool-times.json"
        case .killarney:   return "killarney-pool-times.json"
        case .lordByng:    return "lord-byng-pool-times.json"
        }
    }

    var poolTimesURL: URL {
        URL(string: "https://raw.githubusercontent.com/vipteryx/centretracker/main/data/\(jsonFileName)")!
    }
}
