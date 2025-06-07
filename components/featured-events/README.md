# Featured Events Module

A colocated, well-organized module for managing featured events with custom hooks, separate components, and configurable constants.

## Structure

```
featured-events/
├── README.md                          # This documentation
├── index.ts                          # Main exports
├── constants.ts                      # Configuration constants (server)
├── types.ts                         # TypeScript type definitions (server)
├── FeaturedEvents.tsx               # Main component (client)
├── components/                      # Child components
│   ├── FeaturedEventCard.tsx       # Individual event card (client)
│   ├── FeaturedEventsHeader.tsx    # Header with CTA (client)
│   └── FeatureCountdown.tsx        # Live countdown (client)
└── hooks/                          # Custom hooks
    ├── use-featured-events.ts      # Event selection logic (client)
    └── use-feature-time-remaining.ts # Time calculations (client)
```

## Key Features

### 🎯 Manual Featured Control
- Events with `isFeatured: true` are prioritized in the featured section
- Maximum of 3 featured events (configurable via `MAX_FEATURED_EVENTS`)
- Remaining slots filled with OOOC picks and regular events

### 🔄 Deterministic Shuffling
- Uses date-based seeding to avoid hydration errors
- Consistent server/client rendering
- Daily rotation of non-manually-featured events

### 💰 Monetization Ready
- Built-in CTA for event hosts to feature their events
- Dedicated `/feature-event` page with pricing information
- 48-hour feature duration (configurable)
- €25 pricing (configurable)

### 🏗️ Best Practices
- **Colocated**: All related files in one directory
- **Custom Hooks**: Logic separated into reusable hooks
- **Component Composition**: Small, focused components
- **TypeScript**: Fully typed with proper interfaces
- **No Barrel Files**: Direct imports only
- **Client/Server Separation**: Proper "use client" boundaries for optimal performance

## Usage

### Basic Implementation

```tsx
import { FeaturedEvents } from "@/components/featured-events";

function HomePage({ events }) {
  const handleEventClick = (event) => {
    // Handle event click
  };

  const handleScrollToAllEvents = () => {
    // Scroll to all events section
  };

  return (
    <FeaturedEvents
      events={events}
      onEventClick={handleEventClick}
      onScrollToAllEvents={handleScrollToAllEvents}
      maxFeaturedEvents={3} // Optional: override default
    />
  );
}
```

### Using Individual Components

```tsx
import { 
  FeaturedEventCard, 
  FeaturedEventsHeader,
  FeatureCountdown,
  useFeaturedEvents 
} from "@/components/featured-events";

function CustomFeaturedSection({ events }) {
  const { featuredEvents, totalEventsCount } = useFeaturedEvents(events);
  const featureEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  return (
    <div>
      <FeatureCountdown endDate={featureEndDate} />
      <FeaturedEventsHeader 
        totalEventsCount={totalEventsCount}
        onScrollToAllEvents={() => {}}
      />
      {featuredEvents.map(event => (
        <FeaturedEventCard 
          key={event.id}
          event={event}
          onClick={() => {}}
        />
      ))}
    </div>
  );
}
```

## Configuration

### Constants (constants.ts)

```typescript
export const FEATURED_EVENTS_CONFIG = {
  MAX_FEATURED_EVENTS: 3,           // Maximum featured events
  FEATURE_DURATION_HOURS: 48,       // How long events stay featured
  FEATURE_PRICE: 25,                // Price in euros to feature
  CTA_MESSAGE: "Would you like to feature your event?",
  FEATURE_PAGE_ROUTE: "/feature-event",
};
```

### Event Type Requirements

Events must have the following properties for featured functionality:

```typescript
type Event = {
  // ... other properties
  isFeatured?: boolean;     // Manual featured flag
  isOOOCPick?: boolean;     // OOOC pick flag
  // ... other properties
};
```

## Styling

### Featured Event Badges

- **Featured Badge**: Blue 📌 badge (top-left)
- **OOOC Pick Badge**: Yellow ⭐ badge (top-right)
- **Special Background**: Yellow gradient for OOOC picks

## Performance

### Hydration Safety
- Deterministic shuffling prevents client/server mismatches
- Uses date-based seeding for consistent daily rotation
- Memoized calculations with proper dependencies

### Client/Server Architecture
- **Server Components**: `constants.ts`, `types.ts` (static data, no interactivity)
- **Client Components**: All hooks and interactive components marked with "use client"
- **Optimal Boundaries**: Only client-side code that needs React hooks or event handlers
- **Real-time Updates**: `FeatureCountdown` component updates every minute

### Optimizations
- Component splitting for better code splitting
- Minimal re-renders with proper memoization
- Proper client/server boundaries for optimal bundle size

## Testing

### Key Test Cases
1. **Hydration Consistency**: Server and client render the same content
2. **Featured Priority**: Manually featured events appear first
3. **Fallback Logic**: OOOC picks fill remaining slots
4. **Configuration**: Settings can be changed via constants
5. **Edge Cases**: Handles undefined events gracefully

## Future Enhancements

### Planned Features
- [ ] Real-time feature period countdown
- [ ] Payment integration (Stripe)
- [ ] Analytics tracking for featured events
- [ ] A/B testing for feature positioning
- [ ] Bulk feature management for admins

### Extensibility
The modular structure allows for easy extension:
- Add new badge types
- Implement different shuffling algorithms
- Create custom event card layouts
- Add feature scheduling capabilities

## Dependencies

### Internal
- `@/components/ui/*` - UI components (Card, Button, Badge)
- `@/types/events` - Event type definitions
- `lucide-react` - Icons

### External
- `react` - Component framework
- `next/link` - Navigation
- `next` - Metadata types 