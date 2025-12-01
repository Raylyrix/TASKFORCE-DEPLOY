# TaskForce Chrome Extension - Complete Feature Documentation

## 📋 Table of Contents
1. [Core Architecture](#core-architecture)
2. [Main Features](#main-features)
3. [Components](#components)
4. [Hooks](#hooks)
5. [Services & Utilities](#services--utilities)
6. [Window Management](#window-management)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Gmail Integration](#gmail-integration)

---

## 🏗️ Core Architecture

### Entry Points
- **Content Script** (`src/content/index.tsx`): Main entry point that injects floating windows into Gmail
- **Background Script** (`src/background/index.ts`): Handles background tasks and message passing
- **Popup** (`src/popup/index.tsx`): Extension popup interface
- **Options** (`src/options/index.tsx`): Extension settings page
- **Auth Callback** (`src/auth-callback/index.ts`): OAuth callback handler

### Window System
The extension uses a floating window system with three main windows:
1. **TaskForce Composer** - Email campaign creation
2. **TaskForce Follow-ups** - Follow-up automation management
3. **Email Best Practices** - Best practices guide

---

## ✨ Main Features

### 1. Email Campaign Composer
**Location**: `src/components/ComposerPanel.tsx`

**Features**:
- ✅ **Multi-step Campaign Creation**:
  - Step 1: Audience Selection (Google Sheets import)
  - Step 2: Email Composition (Subject & Body with rich text editor)
  - Step 3: Scheduling & Settings
  - Step 4: Review & Launch

- ✅ **Google Sheets Integration**:
  - Import recipients from Google Sheets
  - Automatic header row detection
  - Field mapping (email, name, company, etc.)
  - Merge field support (`{{firstName}}`, `{{company}}`, etc.)

- ✅ **Rich Text Editor**:
  - HTML email composition
  - Merge field autocomplete
  - Template variables support
  - Real-time preview

- ✅ **File Attachments**:
  - Multiple file upload support
  - Base64 encoding
  - File size validation (25MB limit)
  - MIME type detection

- ✅ **Scheduling Options**:
  - Start date/time selection
  - Delay between emails (milliseconds)
  - Timezone support

- ✅ **Tracking Options**:
  - Email open tracking (optional)
  - Click tracking (optional)
  - Can be completely disabled to avoid spam flags

- ✅ **Follow-up Sequences**:
  - Nested follow-ups support
  - Reply threading
  - Variable replacement in follow-ups
  - Delay configuration

- ✅ **Campaign Launch**:
  - Real-time progress monitoring
  - Launch status tracking
  - Error handling
  - Metrics display

- ✅ **Fresh Instance Support**:
  - New composer windows start with empty draft
  - Session-based instance tracking
  - Prevents cached data in new windows

### 2. Follow-up Automation Panel
**Location**: `src/components/FollowUpPanel.tsx`

**Features**:
- ✅ **Automation Rules Creation**:
  - Rule naming
  - Condition-based triggers
  - Action configuration
  - Stop conditions

- ✅ **Condition Types**:
  - `noReplySince`: Time-based (days)
  - `hasLabel`: Gmail label-based
  - `threadStatus`: Thread status-based

- ✅ **Action Types**:
  - `sendEmail`: Send follow-up email
  - Subject and body templates
  - Variable replacement

- ✅ **Scheduling Modes**:
  - Relative: Send after X days
  - Absolute: Send at specific date/time
  - Weekly: Recurring weekly schedule

- ✅ **Stop Conditions**:
  - Stop on reply
  - Stop on open
  - Stop on click
  - Maximum follow-ups limit

- ✅ **Target Selection**:
  - Gmail label-based targeting
  - Query-based targeting
  - Folder-based targeting

- ✅ **Manual Follow-ups**:
  - Send follow-ups to existing campaigns
  - Nested follow-up support
  - Reply threading support

### 3. Campaigns Panel
**Location**: `src/components/CampaignsPanel.tsx`

**Features**:
- ✅ **Campaign List**:
  - View all campaigns
  - Campaign status display
  - Creation date tracking

- ✅ **Campaign Metrics**:
  - Total recipients
  - Sent count
  - Opens count
  - Clicks count
  - Status labels

- ✅ **Recipient Management**:
  - View all recipients per campaign
  - Recipient status tracking
  - Email address display

- ✅ **Activity Timeline**:
  - Per-recipient activity tracking
  - Timeline of events (sent, opened, clicked)
  - Timestamp display

### 4. Gmail Integration
**Location**: `src/content/gmailTracking.ts`

**Features**:
- ✅ **Email Tracking Indicators**:
  - Visual indicators in Gmail email list
  - Opened/Unopened status
  - Timestamp display on hover
  - Automatic updates

- ✅ **Tracking Data Fetching**:
  - Backend API integration
  - Periodic updates
  - Error handling
  - Context validation

- ✅ **DOM Observation**:
  - MutationObserver for Gmail changes
  - Automatic re-injection
  - Cleanup on page unload

### 5. Best Practices Panel
**Location**: `src/components/BestPracticesPanel.tsx`

**Features**:
- ✅ **Email Best Practices Guide**:
  - Subject line tips
  - Content guidelines
  - Deliverability tips
  - Spam prevention

- ✅ **Modal Display**:
  - Overlay modal
  - Close functionality
  - Accessible design

---

## 🧩 Components

### Core UI Components

1. **AuthCard** (`src/components/AuthCard.tsx`)
   - OAuth connection UI
   - Backend URL display
   - Connection status

2. **Button** (`src/components/Button.tsx`)
   - Reusable button component
   - Variants (primary, secondary)
   - Loading states

3. **Card** (`src/components/Card.tsx`)
   - Container component
   - Consistent styling

4. **TabSwitcher** (`src/components/TabSwitcher.tsx`)
   - Tab navigation
   - Active state management

5. **UserMenu** (`src/components/UserMenu.tsx`)
   - User profile display
   - Disconnect functionality
   - Re-authenticate option

### Feature Components

6. **ComposerPanel** (`src/components/ComposerPanel.tsx`)
   - Main campaign composer
   - Multi-step wizard
   - Form handling

7. **FollowUpPanel** (`src/components/FollowUpPanel.tsx`)
   - Follow-up automation UI
   - Rule creation/editing
   - Condition/action builders

8. **CampaignsPanel** (`src/components/CampaignsPanel.tsx`)
   - Campaign list and details
   - Metrics display
   - Recipient management

9. **FollowUpOverlay** (`src/components/FollowUpOverlay.tsx`)
   - Follow-up sequence editor
   - Step management
   - Nested follow-up support

10. **RichTextEditor** (`src/components/RichTextEditor.tsx`)
    - HTML editor
    - Merge field insertion
    - Content editing

11. **MergeFieldAutocomplete** (`src/components/MergeFieldAutocomplete.tsx`)
    - Autocomplete for merge fields
    - Field suggestions
    - Insertion functionality

12. **CampaignLaunchProgress** (`src/components/CampaignLaunchProgress.tsx`)
    - Launch progress display
    - Status updates
    - Metrics visualization

13. **RecipientActivityTimeline** (`src/components/RecipientActivityTimeline.tsx`)
    - Activity visualization
    - Event timeline
    - Status indicators

14. **MeetingTypePicker** (`src/components/MeetingTypePicker.tsx`)
    - Meeting type selection
    - Booking link insertion
    - Calendar integration

15. **AvailabilityPreview** (`src/components/AvailabilityPreview.tsx`)
    - Calendar availability display
    - Time slot visualization

16. **BookingPagePreview** (`src/components/BookingPagePreview.tsx`)
    - Booking page preview
    - Link generation

17. **FloatingPreviewCard** (`src/components/FloatingPreviewCard.tsx`)
    - Preview card component
    - Floating display

18. **EmailBestPracticesModal** (`src/components/EmailBestPracticesModal.tsx`)
    - Best practices modal
    - Content display

19. **BestPracticesPanel** (`src/components/BestPracticesPanel.tsx`)
    - Best practices content
    - Guide display

---

## 🎣 Hooks

1. **useAuth** (`src/hooks/useAuth.ts`)
   - Authentication state management
   - OAuth connection
   - User profile fetching
   - Disconnect functionality

2. **useBackendConfig** (`src/hooks/useBackendConfig.ts`)
   - Backend URL configuration
   - Configuration loading

3. **useCampaigns** (`src/hooks/useCampaigns.ts`)
   - Campaign list fetching
   - Campaign data management

4. **useFollowUpAutomations** (`src/hooks/useFollowUpAutomations.ts`)
   - Follow-up automation CRUD
   - Rule management

5. **useFollowUps** (`src/hooks/useFollowUps.ts`)
   - Follow-up sequence management
   - Campaign-specific follow-ups

6. **useGmailLabels** (`src/hooks/useGmailLabels.ts`)
   - Gmail label fetching
   - Label management

7. **useSchedulerBootstrap** (`src/hooks/useSchedulerBootstrap.ts`)
   - Calendar connection initialization
   - Meeting type loading
   - Availability fetching

---

## 🔧 Services & Utilities

### API Client (`src/shared/apiClient.ts`)
- **Functions**:
  - `request<T>()`: Generic API request handler
  - Automatic authentication header injection
  - Error handling
  - Response parsing

### Scheduler API (`src/shared/schedulerApi.ts`)
- **Functions**:
  - `getCalendarConnections()`: Fetch calendar connections
  - `getMeetingTypes()`: Fetch meeting types
  - `getAvailability()`: Fetch calendar availability
  - `syncCalendar()`: Trigger calendar sync

### Storage (`src/shared/storage.ts`)
- **Functions**:
  - `get()`: Get stored value
  - `set()`: Set stored value
  - `remove()`: Remove stored value
  - `clear()`: Clear all storage

### Auth (`src/shared/auth.ts`)
- **Functions**:
  - `getAuthState()`: Get current auth state
  - `setAuthState()`: Set auth state
  - `clearAuthState()`: Clear auth state

### Messages (`src/shared/messages.ts`)
- **Functions**:
  - `sendRuntimeMessage()`: Send message to background script
  - Type-safe message passing

### Config (`src/shared/config.ts`)
- **Functions**:
  - `getBackendUrl()`: Get backend URL
  - `setBackendUrl()`: Set backend URL
  - Default backend URL configuration

---

## 🪟 Window Management

### Window System Functions (`src/content/index.tsx`)

1. **Window Lifecycle**:
   - `spawnWindow()`: Create new window instance
   - `createWindowInstance()`: Initialize window DOM
   - `destroyWindow()`: Remove window instance
   - `setWindowVisibility()`: Show/hide window
   - `setWindowMinimized()`: Minimize/restore window

2. **Window State**:
   - `loadState()`: Load persisted window states
   - `persistState()`: Save window states
   - `updateWindowStateSnapshot()`: Update window state
   - `sanitizeState()`: Validate and clamp window positions/sizes
   - `getDefaultEntry()`: Get default window state

3. **Window Interaction**:
   - `activateWindow()`: Bring window to front
   - `refreshWindowElevation()`: Update z-index
   - `focusFallbackWindow()`: Focus next available window
   - `applyWindowLayout()`: Apply position/size to DOM
   - `reflowMinimizedWindows()`: Reposition minimized windows

4. **Window Dragging**:
   - Mouse event handlers for dragging
   - Drag offset calculation
   - Position clamping to viewport

5. **Window Resizing**:
   - Mouse event handlers for resizing
   - Size constraints
   - Minimum/maximum size enforcement

6. **Window Animations**:
   - `playWindowCue()`: Play minimize/restore animations
   - `ensureAnimationStyles()`: Inject CSS animations

7. **Sidebar Integration**:
   - `ensureSidebarButtons()`: Create sidebar buttons
   - `updateButtonState()`: Update button appearance
   - `isSidebarCollapsed()`: Detect sidebar collapse
   - Responsive button styling (icon-only when collapsed)

---

## 📦 State Management

### Zustand Store (`src/shared/store.ts`)

**State Structure**:
- `user`: User profile
- `backendUrl`: Backend API URL
- `campaigns`: Campaign list
- `campaignMetrics`: Per-campaign metrics
- `selectedTab`: Active tab (composer/followUps/campaigns)
- `composerDraft`: Composer form state
- `followUpOverlay`: Follow-up editor state
- `scheduler`: Calendar/scheduler state

**Actions**:
- `setUser()`: Update user
- `setBackendUrl()`: Update backend URL
- `setCampaigns()`: Update campaign list
- `setCampaignMetrics()`: Update campaign metrics
- `setSelectedTab()`: Switch tabs
- `updateComposerDraft()`: Update composer form
- `resetComposerDraft()`: Reset composer form
- `openFollowUpOverlay()`: Open follow-up editor
- `closeFollowUpOverlay()`: Close follow-up editor
- `updateFollowUpDraft()`: Update follow-up sequence
- `setSchedulerState()`: Update scheduler state
- `resetSchedulerState()`: Reset scheduler state
- `upsertMeetingTypes()`: Add/update meeting types
- `upsertCalendarConnections()`: Add/update calendar connections
- `setSelectedMeetingType()`: Select meeting type
- `setSelectedBookingLink()`: Select booking link
- `setAvailabilityData()`: Set availability data
- `setAvailabilityLoading()`: Set loading state
- `startCalendarSync()`: Start calendar sync
- `completeCalendarSync()`: Complete calendar sync

**Persistence**:
- Composer draft auto-saves to localStorage
- Fresh instances don't load cached data
- Session-based instance tracking

---

## 🔌 API Integration

### Endpoints Used

**Campaigns**:
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create campaign
- `PATCH /api/campaigns/:id` - Update campaign
- `GET /api/campaigns/:id/recipients` - Get recipients
- `GET /api/campaigns/:id/recipients/:email/activity` - Get recipient activity

**Follow-ups**:
- `GET /api/follow-ups` - List follow-up automations
- `POST /api/follow-ups` - Create follow-up automation
- `PUT /api/follow-ups/:id` - Update follow-up automation
- `DELETE /api/follow-ups/:id` - Delete follow-up automation
- `POST /api/follow-ups/send` - Send manual follow-up

**Tracking**:
- `GET /api/tracking/sent-emails` - Get tracking data

**Calendar/Scheduler**:
- `GET /api/calendar/connections` - Get calendar connections
- `GET /api/calendar/meeting-types` - Get meeting types
- `GET /api/calendar/availability` - Get availability
- `POST /api/calendar/sync` - Sync calendar

**Gmail Labels**:
- `GET /api/gmail/labels` - Get Gmail labels

---

## 📧 Gmail Integration

### Features

1. **Floating Windows**:
   - Injected into Gmail interface
   - Draggable and resizable
   - Multiple instances support
   - State persistence

2. **Sidebar Buttons**:
   - Integrated into Gmail sidebar
   - Responsive design (icon-only when collapsed)
   - Apple-style gray color scheme
   - Rectangular buttons with rounded corners

3. **Email Tracking**:
   - Visual indicators in email list
   - Opened/unopened status
   - Automatic updates

4. **Gmail Labels**:
   - Fetch user's Gmail labels
   - Use labels for targeting
   - Label-based automation

---

## 🎨 UI/UX Features

1. **Responsive Design**:
   - Sidebar buttons adapt to Gmail sidebar width
   - Icon-only mode when collapsed
   - Full mode when expanded

2. **Apple-Style Design**:
   - Gray color palette
   - Rounded corners (8px)
   - Consistent icon sizing (20px × 20px)
   - Smooth transitions

3. **Window Management**:
   - Drag and drop
   - Resize handles
   - Minimize/restore
   - Z-index management
   - Viewport clamping

4. **Form Features**:
   - Multi-step wizards
   - Auto-save
   - Validation
   - Error handling
   - Loading states

5. **Real-time Updates**:
   - Campaign progress
   - Tracking indicators
   - Metrics updates

---

## 🔐 Security & Privacy

1. **OAuth Authentication**:
   - Secure OAuth flow
   - Token management
   - Automatic refresh

2. **Data Storage**:
   - Local storage for drafts
   - Session storage for fresh instances
   - Secure token storage

3. **API Security**:
   - Authentication headers
   - HTTPS only
   - Error handling

---

## 🚀 Performance

1. **Lazy Loading**:
   - Components load on demand
   - Code splitting

2. **State Management**:
   - Efficient Zustand store
   - Selective updates

3. **DOM Observation**:
   - Efficient MutationObserver usage
   - Cleanup on unmount

4. **API Caching**:
   - React Query for caching
   - Automatic refetching

---

## 📝 Notes

- All merge fields support variable replacement
- Follow-ups support nested sequences
- Tracking can be completely disabled
- Fresh composer instances start empty
- Sidebar buttons are fully responsive
- All icons are consistently sized (20px × 20px)
- Buttons use Apple-style gray colors
- Rectangular buttons with 8px rounded corners

---

## 🐛 Known Limitations

1. Gmail DOM changes may require re-injection
2. Extension context can be invalidated on page reload
3. File size limit: 25MB per attachment
4. Maximum follow-ups per sequence: Configurable

---

## 🔄 Future Enhancements

Potential areas for improvement:
- Bulk operations
- Advanced filtering
- Export functionality
- Analytics dashboard
- Template library
- A/B testing

---

**Last Updated**: 2025-01-29
**Version**: Production Build


