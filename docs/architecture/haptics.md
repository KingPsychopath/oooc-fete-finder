# Haptics

Fete Finder uses `web-haptics` for subtle mobile feedback. All app code should go through `useAppHaptics()` rather than importing `web-haptics` directly.

## System

- Hook: `hooks/useAppHaptics.ts`
- Dependency: `web-haptics`
- User setting: `enableHaptics`
- Default: `true`
- Toggle location: App Settings -> Mobile feedback -> Haptic feedback
- Test affordance: App Settings -> Mobile feedback -> Test haptics
- Persistence: local app settings and synced user app settings

The hook intentionally does not gate on `navigator.vibrate` because WebHaptics has a touch fallback that can work when the Vibration API reports unavailable.

## Pattern Semantics

- `selection`: ordinary tap/select/open actions
- `light`: dismiss, close, unsave, or gentle reverse actions
- `nudge`: panel/drawer open, guided movement, map expansion, or attention shift
- `success`: completed positive actions, saved/shared/copied, or high-value event opens
- `warning`: reset/clear/sign-out style actions
- `error`: failed copy/share/submit/validation
- `buzz`: unused; reserve for a truly critical alert only

## Current Surfaces

### App Settings

File: `components/AppSettingsModal.tsx`

- Map preference changes: `selection`
- Default event sort changes: `selection`
- Map load strategy changes: `selection`
- Theme changes: `selection`
- Hide floating filter button toggle: `selection`
- Hide support/install prompts toggle: `selection`
- Haptic feedback toggle: `selection`
- Reset settings first press: `warning`
- Reset settings confirm: `success`
- Test haptics button: `success`
- Done button: `success`

### Mobile Bottom Nav

File: `components/MobileBottomNav.tsx`

- Pin/unpin nav: `selection`
- Main nav item taps: `selection`
- More menu open/close: `nudge` / `light`
- Tour start from More: `nudge`
- Settings open: `selection`
- Login open: `selection`
- Logout: `warning`
- More menu links: `selection`
- Playlist open: `selection`

### Event Cards And Lists

Files:

- `features/events/components/EventCard.tsx`
- `features/events/components/AllEvents.tsx`

Triggers:

- Event card open: `selection`
- Sort mode change: `selection`
- Filter button open: `nudge`
- Clear filters: `warning`
- Near me: `selection`
- Saved-only toggle: `selection`
- Show all events from saved empty state: `selection`
- Empty-state clear filters: `warning`
- Show more events: `selection`
- Auth-gated locked section open: `nudge`

### Featured Events

File: `features/events/featured/FeaturedEvents.tsx`

- Featured/OOOC spotlight open: `success`
- Regular spotlight open: `selection`
- Browse all events: `nudge`

### Search And Date Filters

Files:

- `features/events/components/SearchBar.tsx`
- `features/events/components/DateRangePickerControl.tsx`

Triggers:

- Clear search: `light`
- Example search chip: `selection`
- Popular search chip: `selection`
- Date range changes, native date inputs, calendar selection, and quick date toggles: `selection`

### Filter Panel

File: `features/events/components/FilterPanel.tsx`

- Price reset: `warning`
- Age reset: `warning`
- Clear filters: `warning`
- Active filter chip remove: `selection`
- Genre include/exclude controls: `selection`
- OOOC Picks toggle: `selection`
- Venue type toggle: `selection`
- Day/night toggle: `selection`
- Nationality toggle: `selection`
- Arrondissement toggle: `selection`
- Date reset to default: `warning`
- Floating filter button open: `nudge`
- Desktop filter rail expand/collapse: `nudge`
- Drawer close: `light`
- Drawer Done button: `success`

### Event Modal

File: `features/events/components/EventModal.tsx`

- Open map picker when map preference is Ask: `nudge`
- Open location directly in map app: `selection`
- Map preference changes inside modal settings: `selection`
- Copy contact email success/failure: `success` / `error`
- Copy update URL success/failure: `success` / `error`
- Native share or link copy success/failure: `success` / `error`
- Open update request form: `nudge`
- Update request validation errors: `error`
- Update request server failure: `error`
- Update request submitted: `success`
- External event links: `selection`
- Add to calendar: `success`
- Save event: `success`
- Unsave event: `light`

### Map Selection Modal

File: `features/maps/components/map-selection-modal.tsx`

- Select map provider or set default: `success`
- Backdrop close: `light`
- X close: `light`
- Cancel: `light`

### Paris Map

File: `features/maps/components/ParisMapLibre.tsx`

- Select arrondissement: `selection`
- Deselect selected arrondissement: `light`
- Event marker open for Featured/OOOC event: `success`
- Event marker open for regular event: `selection`
- Cluster expand/zoom: `nudge`
- Zoom in/out controls: `selection`
- Locate notice: `nudge`
- Fullscreen open/close: `nudge`
- Map retry: `selection`
- Fullscreen filter button: `nudge`
- Arrondissement drawer close: `light`
- Arrondissement drawer event open for Featured/OOOC event: `success`
- Arrondissement drawer event open for regular event: `selection`

### Guided Tour

File: `features/events/components/FeteFinderTour.tsx`

- Manual tour request: `nudge`
- Start tour: `nudge`
- Start deferred because another overlay is blocking: `nudge`
- Next/previous step: `nudge`
- Prompt dismiss/skip/close: `light`
- Tour completed: `success`

## Adding New Haptics

Use `const haptics = useAppHaptics()` in client components and choose the weakest pattern that communicates the state change.

Avoid haptics for:

- Typing
- Scrolling
- Hover-only interactions
- Passive loading states
- Every slider movement
- Repeated automatic effects

Avoid `buzz` unless the app needs to signal a rare, critical, user-impacting failure.
