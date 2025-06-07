# Featured Events System

A comprehensive system for displaying and managing featured events with automatic expiration based on timestamps.

## Overview

The Featured Events system automatically displays a curated selection of events with support for both manual and timestamp-based featuring. Events are prioritized and filtered based on their featured status and expiration times.

## Key Features

- **Automatic Expiration**: Events with valid timestamps expire after 48 hours (configurable)
- **Permanent Manual Features**: Events marked as featured without timestamps display permanently
- **Deterministic Shuffling**: Consistent server/client rendering using date-based seeds
- **Responsive Design**: Adapts to mobile, tablet, and desktop layouts
- **Real-time Updates**: Live countdown timers and progress bars for timestamp-based events

## Component Structure

```
components/featured-events/
├── FeaturedEvents.tsx          # Main component
├── components/
│   ├── FeaturedEventsHeader.tsx    # Header with counts and CTA
│   └── FeatureCountdown.tsx        # Individual event countdown cards
├── hooks/
│   └── use-featured-events.ts      # Event selection and filtering logic
├── utils/
│   └── timestamp-utils.ts          # Timestamp validation and expiration utilities
├── constants.ts                    # Configuration constants
├── types.ts                       # TypeScript type definitions
└── README.md                      # This documentation
```

## How It Works

### Event Selection Priority

1. **Featured Events**: Events marked as `isFeatured: true` (highest priority)
   - With valid timestamps: Display until expired
   - Without timestamps: Display permanently
2. **OOOC Picks**: Events marked as `isOOOCPick: true` (medium priority)
3. **Regular Events**: All other events (lowest priority)

### Timestamp Behavior

#### Valid Timestamps
Events with valid ISO timestamps (e.g., `"2024-01-20T14:30:00Z"`) in the `featuredAt` field:
- Display with real-time countdown timers
- Automatically expire after configured duration (default: 48 hours)
- Show progress bars indicating time remaining
- Removed from featured section when expired

#### Manual Features
Events marked as featured without valid timestamps (e.g., `featured: "Yes"` or `featured: "urgent"`):
- Display permanently until manually removed
- Show "Featured for 24 hours" message
- Green theme with shimmer effects
- No automatic expiration

## Usage Example

```tsx
import { FeaturedEvents } from "@/components/featured-events/FeaturedEvents";

function HomePage({ events }: { events: Event[] }) {
  return (
    <FeaturedEvents
      events={events}
      onEventClick={(event) => console.log('Event clicked:', event.name)}
      onScrollToAllEvents={() => scrollToSection('all-events')}
      maxFeaturedEvents={3}
    />
  );
}
```

## Configuration

### Constants (`constants.ts`)

```typescript
export const FEATURED_EVENTS_CONFIG = {
  MAX_FEATURED_EVENTS: 3,           // Maximum featured events to display
  FEATURE_DURATION_HOURS: 48,       // Hours before timestamp-based events expire
  FEATURE_PRICE: 50,                // Cost to feature an event (€)
  CTA_MESSAGE: "Get noticed by thousands more by featuring your event →",
  FEATURE_PAGE_ROUTE: "/feature-event",
};
```

### Limits and Validation

```typescript
export const FEATURED_EVENTS_LIMITS = {
  MIN_FEATURED_EVENTS: 1,
  MAX_FEATURED_EVENTS_LIMIT: 10,
  MIN_FEATURE_DURATION_HOURS: 1,
  MAX_FEATURE_DURATION_HOURS: 168,  // 1 week maximum
  MIN_FEATURE_PRICE: 0,
  MAX_FEATURE_PRICE: 1000,
};
```

## CSV Integration

The system reads from CSV files with these columns:

- `featured`: Any non-empty value marks event as featured
- `featuredAt`: ISO timestamp or Excel date format for expiration tracking

### Example CSV Data

```csv
featured,featuredAt,name,date,location
Yes,,Manual Feature Event,2024-01-25,Paris
urgent,2024-01-20T14:30:00Z,Timestamp Event,2024-01-26,London
,2024-01-19T10:00:00Z,Expired Event,2024-01-27,Berlin
```

## API Reference

### Core Functions

#### `shouldDisplayFeaturedEvent(event: Event): boolean`
Determines if an event should be displayed as featured based on its timestamp and expiration status.

#### `isValidTimestamp(timestamp?: string): boolean`
Validates if a string is a valid ISO timestamp.

#### `isFeaturedEventExpired(featuredAt?: string, durationHours?: number): boolean`
Checks if a timestamp-based featured event has expired.

#### `getFeaturedEventExpirationDate(featuredAt?: string, durationHours?: number): Date | null`
Returns the expiration date for a featured event, or null if no valid timestamp.

### Hook: `useFeaturedEvents`

```typescript
const { featuredEvents, totalEventsCount, hasMoreEvents } = useFeaturedEvents(
  events,           // Event[] - All events to filter from
  maxFeaturedEvents // number - Maximum events to return (default: 3)
);
```

Returns:
- `featuredEvents`: Array of selected featured events
- `totalEventsCount`: Total number of events available
- `hasMoreEvents`: Boolean indicating if there are more events than featured

## Best Practices

### For Event Organizers
- Use timestamps for time-sensitive promotions with automatic cleanup
- Use manual features ("Yes", "urgent") for ongoing promotions
- Coordinate with the team to avoid over-featuring during busy periods

### For Developers
- Always validate timestamps before using them in calculations
- Use the utility functions for consistent timestamp handling
- Consider timezone implications when working with timestamps
- Test both timestamp and manual feature scenarios

## Troubleshooting

### Common Issues

1. **Events not appearing as featured**
   - Verify `isFeatured: true` in the Event object
   - Check if timestamp-based events have expired
   - Ensure CSV parsing is correctly setting the featured fields

2. **Hydration errors**
   - The system uses deterministic shuffling to prevent server/client mismatches
   - Avoid using `Math.random()` in event selection logic

3. **Timestamp parsing errors**
   - Ensure timestamps are in valid ISO format
   - Check that Excel dates are properly converted during CSV parsing
   - Use the `isValidTimestamp()` utility for validation

### Debug Tips

- Check browser console for validation warnings
- Use React DevTools to inspect hook state
- Verify CSV data format matches expected structure
- Test with both timestamp and manual feature scenarios

## Performance Considerations

- Event filtering runs on every render but is memoized
- Deterministic shuffling prevents unnecessary re-renders
- Large event lists are efficiently filtered using array methods
- Real-time updates use intervals, consider cleanup on unmount

## Future Enhancements

- Admin interface for managing featured events
- Analytics for featured event performance
- A/B testing for different featured layouts
- Integration with payment processing for automated featuring 