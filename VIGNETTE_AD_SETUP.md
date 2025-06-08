# Vignette Ad Setup

This project includes a smart, mobile-first vignette ad component that guides users to join the WhatsApp community chat.

## File Structure

The vignette ad feature is organized in `features/vignette-ad/` with clean folder structure:

```
features/vignette-ad/
├── components/
│   └── vignette-ad.tsx      # Main component
├── hooks/
│   └── use-vignette-ad-storage.ts # Storage hook
├── config.ts                # Configuration
├── constants.ts             # Storage keys and delays
├── utils.ts                 # Time conversion utilities
└── types.ts                 # TypeScript types
```

### Architecture Benefits

- **Organized structure**: Components and hooks are in dedicated folders
- **Colocated concerns**: All related code lives together in the feature folder
- **Clean separation**: Types, constants, hooks, utils, and config are in separate files
- **No barrel files**: Direct imports maintain clear dependencies
- **Type safety**: Comprehensive TypeScript types for all interfaces
- **Testability**: Each part can be tested independently
- **Client components**: Proper "use client" directives for React hooks
- **Performance optimized**: useCallback for event handlers, proper cleanup of timeouts
- **Memory leak prevention**: Cleanup of all timers on unmount
- **Mobile scroll-friendly**: Positioned only from bottom-right to avoid blocking scroll areas
- **Professional design**: Optimized sizing, spacing, and visual hierarchy
- **Accessibility compliant**: WCAG 2.1 AA standards with screen reader support

## Features

- **Mobile-first responsive design** - Optimized for iOS and mobile devices with touch-friendly interactions
- **Smart storage management** - Uses localStorage to track user interactions
- **Configurable delays** - Customizable timing for when to show/hide the ad
- **Minimally intrusive** - Subtle animation and optimal positioning
- **Accessibility compliant** - Comprehensive ARIA labels, keyboard navigation, focus management
- **Professional design** - Optimal spacing, typography, and visual hierarchy
- **Theme-aware** - Integrates seamlessly with light/dark theme system
- **Performance optimized** - Enhanced shadows, smooth animations, minimal re-renders

## How it Works

The vignette ad appears in the bottom-right corner of the screen with smart behavior:

1. **Initial Display**: Shows after 1 second of page load (configurable)
2. **User Clicks Chat Link**: Ad won't appear again for 4 days (configurable)
3. **User Dismisses Ad**: Ad will reappear after 2 days or next visit (configurable)
4. **Graceful Degradation**: Works even if localStorage is unavailable

## Configuration

All settings are centralized in `features/vignette-ad/config.ts`:

```typescript
export const VIGNETTE_AD_CONFIG = {
  // WhatsApp chat URL
  WHATSAPP_URL: "https://chat.whatsapp.com/J67nTzkE5BtIbWZm5lOOPr",
  
  // Delay configurations (in milliseconds)
  DELAYS: {
    AFTER_CHAT_CLICK: 4 * 24 * 60 * 60 * 1000, // 4 days
    AFTER_DISMISS: 2 * 24 * 60 * 60 * 1000,    // 2 days
    INITIAL_DELAY: 1000,                        // 1 second
  },
  
  // UI Configuration
  UI: {
    ANIMATION_DURATION: 300, // milliseconds
    Z_INDEX: 50,
    EDGE_OFFSET: "20px",
  },
  
  // Content Configuration
  CONTENT: {
    TITLE: "Join Our Community",
    DESCRIPTION: "Connect with other music lovers and get real-time updates...",
    CTA_TEXT: "Join WhatsApp Chat",
  },
};
```

### Helper Functions

The config file includes utility functions for easier time configuration:

```typescript
import { daysToMs, hoursToMs, minutesToMs } from '@/features/vignette-ad/utils';

// Examples:
const threeDays = daysToMs(3);     // 3 days in milliseconds
const twoHours = hoursToMs(2);     // 2 hours in milliseconds
const thirtyMins = minutesToMs(30); // 30 minutes in milliseconds
```

## Implementation

The ad is currently added to the root layout (`app/layout.tsx`) so it appears on all pages:

```tsx
import { VignetteAd } from "@/features/vignette-ad/components/vignette-ad";
import { VIGNETTE_AD_CONFIG } from "@/features/vignette-ad/config";

// In your JSX:
<VignetteAd 
  whatsappUrl={VIGNETTE_AD_CONFIG.WHATSAPP_URL}
  delayAfterChatClick={VIGNETTE_AD_CONFIG.DELAYS.AFTER_CHAT_CLICK}
  delayAfterDismiss={VIGNETTE_AD_CONFIG.DELAYS.AFTER_DISMISS}
/>
```

## Customization

### Custom Delays

You can override the default delays:

```tsx
<VignetteAd 
  whatsappUrl="your-whatsapp-url"
  delayAfterChatClick={daysToMs(7)}  // 7 days instead of 4
  delayAfterDismiss={hoursToMs(12)}  // 12 hours instead of 2 days
/>
```

### Custom Styling

Add custom CSS classes:

```tsx
<VignetteAd 
  whatsappUrl="your-whatsapp-url"
  className="custom-positioning"
/>
```

### Different Placement

To show the ad on specific pages only, remove it from the root layout and add it to individual page components.

## Storage Keys

The component uses these localStorage keys:
- `whatsapp_chat_clicked` - Timestamp when user clicked the chat link
- `whatsapp_ad_dismissed` - Timestamp when user dismissed the ad

## Testing

For testing purposes, you can clear the storage:

```javascript
// In browser console:
localStorage.removeItem('whatsapp_chat_clicked');
localStorage.removeItem('whatsapp_ad_dismissed');
```

Or use the hook's clear function:

```typescript
const { clearStorage } = useVignetteAdStorage();
clearStorage(); // Clears all vignette ad related storage
```

## Design & UX

### Professional Appearance
- **Optimal Sizing**: 320px width on desktop, 300px on small screens with responsive constraints
- **Enhanced Shadows**: Depth-aware shadows that respond to animation state
- **Refined Typography**: Improved line heights, letter spacing, and font weights
- **Visual Hierarchy**: Clear distinction between title, description, and action elements
- **Consistent Spacing**: Professional 20px padding with structured spacing system

### Mobile Optimization
- **Touch-Friendly**: 44px minimum touch targets for all interactive elements
- **Responsive Design**: Adapts fluidly from 320px down to viewport constraints
- **Performance**: Hardware-accelerated animations with `touch-manipulation`
- **Positioning**: Bottom-right placement that doesn't interfere with scroll areas

### Visual Polish
- **Backdrop Blur**: Enhanced backdrop blur for modern glass-morphism effect
- **Icon Treatment**: Icons placed in subtle background containers for better visual grouping
- **Button States**: Comprehensive hover, active, and focus states
- **Animation**: Subtle spring-like animation with optimal timing curves

## Browser Support

- Works in all modern browsers that support localStorage
- Gracefully degrades if localStorage is unavailable
- Mobile-optimized for iOS Safari and Android Chrome
- Responsive design works on all screen sizes

## Accessibility

This component meets WCAG 2.1 AA accessibility standards:

- **Screen Reader Support**: Proper ARIA labels, roles, and descriptions
- **Keyboard Navigation**: Full keyboard support with Escape key to close
- **Focus Management**: Visible focus indicators and logical tab order
- **Semantic HTML**: Proper heading structure and complementary role
- **Color Contrast**: High contrast text and interactive elements
- **Touch Targets**: Minimum 44px touch targets for mobile accessibility
- **Motion**: Respects user's reduced motion preferences
- **Screen Reader Announcements**: Descriptive text for all interactive elements

### Keyboard Shortcuts
- `Escape` - Close the vignette ad
- `Tab` - Navigate between interactive elements
- `Enter/Space` - Activate buttons

### Screen Reader Experience
- Announced as "Community invitation" complementary content
- Clear descriptions for all buttons and actions
- Hidden descriptive text for context 