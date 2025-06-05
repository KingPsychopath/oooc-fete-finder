# Authentication Feature

## Overview

The Fête Finder app now includes an email-based authentication system that gates access to filtering and search functionality while still allowing users to view events.

## How It Works

### User Experience
1. **Initial Visit**: Users can view the page, see all events, and browse the map without restrictions
2. **Filter/Search Attempt**: When users try to use filters or search, they're prompted to enter their email
3. **Email Collection**: A modal appears requesting their email address
4. **Access Granted**: After providing email, users can use all filtering and search features
5. **Persistent Session**: Email is stored in localStorage for future visits

### Technical Implementation

#### Components Added
- **`EmailGateModal`**: Modal component for collecting user emails
- **`AuthGate`**: Wrapper component that shows overlay when authentication is required
- **`AuthProvider`**: React Context provider for managing authentication state

#### Authentication Flow
1. **Context Management**: `useAuth()` hook provides authentication state
2. **Local Storage**: Email is persisted in browser localStorage
3. **API Integration**: Optional backend endpoint (`/api/auth`) for email collection
4. **Visual Feedback**: Header shows authenticated user status

#### Protected Features
- All filter controls (days, genres, arrondissements, etc.)
- Search functionality
- OOOC Picks toggle
- Filter panel interactions

#### Unprotected Features
- Viewing all events
- Browsing the map
- Reading event details
- Basic navigation

## Benefits

### For Users
- **Low Friction**: Only requires email, no complex signup
- **Immediate Access**: Can browse events before committing
- **Persistent Session**: Don't need to re-enter email on return visits

### For Organizers
- **Email Collection**: Build mailing list for future events
- **Usage Analytics**: Track who's actively filtering vs. browsing
- **Engagement Metrics**: Understand conversion from viewer to engaged user

## Configuration

### Environment Variables
- `NEXT_PUBLIC_BASE_PATH`: Base path for assets (optional)

### Storage
- **Frontend**: localStorage with key `fete_finder_user_email`
- **Backend**: Optional API endpoint for server-side storage

## Future Enhancements

### Potential Additions
1. **Google OAuth**: Add social login option
2. **Email Verification**: Send confirmation emails
3. **User Preferences**: Save filter preferences per user
4. **Analytics**: Track user engagement patterns
5. **Mailing List Integration**: Connect to email marketing platforms

### Database Integration
The current implementation uses localStorage. For production, consider:
- Database storage for emails
- User preference tracking
- Analytics and engagement metrics
- Email marketing platform integration

## Privacy Considerations

- **Minimal Data**: Only collects email addresses
- **Transparent Usage**: Clear messaging about how email will be used
- **Local Storage**: No server-side tracking by default
- **Optional Backend**: API endpoint is optional and can be disabled

## Best Practices

### UX Guidelines
- Keep the email gate lightweight and non-intrusive
- Clearly communicate the value of providing email
- Allow users to explore before requiring authentication
- Provide easy logout functionality

### Technical Guidelines
- Handle API failures gracefully (fallback to localStorage)
- Validate email addresses on both client and server
- Consider rate limiting for the auth endpoint
- Implement proper error handling and user feedback 