# Shared Hooks

This directory contains reusable React hooks that can be shared across the application.

## Available Hooks

### `useScrollVisibility`

A flexible hook for scroll-based visibility detection that can handle different use cases:

```typescript
import { useScrollVisibility } from "@/hooks/use-scroll-visibility";

const { isVisible, scrollPercentage } = useScrollVisibility({
  threshold: 20, // Percentage of page scrolled (0-100)
  mode: "show-after", // or "hide-after"
  initiallyVisible: false,
});
```

#### Parameters

- `threshold` (number): Percentage of page scrolled (0-100)
- `mode` (optional): 
  - `"show-after"` (default): Shows element after scrolling past threshold
  - `"hide-after"`: Hides element after scrolling past threshold
- `initiallyVisible` (optional, boolean): Initial visibility state

#### Returns

- `isVisible` (boolean): Current visibility state based on scroll position
- `scrollPercentage` (number): Current scroll percentage (0-100)

#### Use Cases

1. **Scroll-to-top button** (`mode: "show-after"`):
   ```typescript
   const { isVisible } = useScrollVisibility({
     threshold: 20,
     mode: "show-after",
     initiallyVisible: false,
   });
   ```

2. **Vignette ads** (`mode: "hide-after"`):
   ```typescript
   const { isVisible } = useScrollVisibility({
     threshold: 20,
     mode: "hide-after", 
     initiallyVisible: true,
   });
   ```

#### Performance Features

- Uses `requestAnimationFrame` for throttled scroll detection
- Passive event listeners for better performance
- Automatic cleanup on unmount
- Division by zero protection for short pages

## Architecture

These hooks follow the project's architectural principles:

- **No barrel imports**: Direct imports only
- **TypeScript-first**: Comprehensive type definitions
- **Performance-optimized**: Efficient event handling and cleanup
- **Accessible**: Works well with screen readers and assistive technologies
- **Maintainable**: Clear interfaces and documentation 