import Foundation
import CoreLocation

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
        guard let url = URL(string: "https://raw.githubusercontent.com/vipteryx/centretracker/main/data/\(activity)/\(slug).json") else {
            preconditionFailure("Invalid URL for activity \(activity) venue \(slug)")
        }
        return url
    }

    var poolTimesURL: URL { activityURL(activity: "pool") }

    var address: String {
        switch self {
        case .hillcrest:   return "4575 Clancy Loranger Way, Vancouver"
        case .britannia:   return "1661 Napier St, Vancouver"
        case .aquatic:     return "1050 Beach Ave, Vancouver"
        case .templeton:   return "700 Templeton Dr, Vancouver"
        case .renfrew:     return "2929 E 22nd Ave, Vancouver"
        case .kensington:  return "5175 Dumfries St, Vancouver"
        case .killarney:   return "6260 Killarney St, Vancouver"
        case .lordByng:    return "3990 W 14th Ave, Vancouver"
        }
    }

    var coordinate: CLLocationCoordinate2D {
        switch self {
        case .hillcrest:   return CLLocationCoordinate2D(latitude: 49.2434, longitude: -123.1088)
        case .britannia:   return CLLocationCoordinate2D(latitude: 49.2756, longitude: -123.0710)
        case .aquatic:     return CLLocationCoordinate2D(latitude: 49.2773, longitude: -123.1345)
        case .templeton:   return CLLocationCoordinate2D(latitude: 49.2804, longitude: -123.0490)
        case .renfrew:     return CLLocationCoordinate2D(latitude: 49.2520, longitude: -123.0430)
        case .kensington:  return CLLocationCoordinate2D(latitude: 49.2484, longitude: -123.0753)
        case .killarney:   return CLLocationCoordinate2D(latitude: 49.2270, longitude: -123.0457)
        case .lordByng:    return CLLocationCoordinate2D(latitude: 49.2618, longitude: -123.1887)
        }
    }
}
