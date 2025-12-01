# TaskForce Database Schema Documentation

## 📊 Overview

**Database**: PostgreSQL  
**Total Models/Tables**: 34  
**ORM**: Prisma

---

## 📋 Complete Data Inventory

### 1. **User Management**

#### `User` Table
**Purpose**: Core user accounts  
**Data Stored**:
- `id` (String, CUID) - Unique user identifier
- `email` (String, unique) - User email address
- `displayName` (String, optional) - User's display name
- `pictureUrl` (String, optional) - Profile picture URL
- `createdAt` (DateTime) - Account creation timestamp
- `updatedAt` (DateTime) - Last update timestamp

**Relationships**: 
- 1:1 with `OAuthCredential`
- 1:Many with Campaigns, SheetSources, CalendarConnections, etc.

**Estimated Size**: ~200 bytes per user

---

#### `OAuthCredential` Table
**Purpose**: OAuth tokens for Gmail/Google API access  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String, unique) - Foreign key to User
- `accessToken` (String) - OAuth access token (encrypted)
- `refreshToken` (String) - OAuth refresh token (encrypted)
- `scope` (String) - OAuth scopes granted
- `tokenType` (String) - Token type (usually "Bearer")
- `expiryDate` (DateTime) - Token expiration
- `createdAt`, `updatedAt` (DateTime)

**Security**: Contains sensitive OAuth tokens (should be encrypted at rest)

**Estimated Size**: ~500-1000 bytes per credential

---

### 2. **Email Campaigns**

#### `Campaign` Table
**Purpose**: Email campaign definitions  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Campaign owner
- `sheetSourceId` (String, optional) - Linked Google Sheet
- `name` (String) - Campaign name
- `status` (Enum: DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, CANCELLED)
- `sendStrategy` (JSON) - Contains:
  - `startAt` (ISO date string)
  - `delayMsBetweenEmails` (number)
  - `trackOpens` (boolean)
  - `trackClicks` (boolean)
  - `template.subject` (string)
  - `template.html` (string, can be large)
  - `template.attachments` (array of file metadata)
- `trackingConfig` (JSON) - Tracking settings
- `folderId` (String, optional) - Campaign folder/label
- `gmailLabelId` (String, optional) - Gmail label ID
- `createdAt`, `updatedAt`, `scheduledSendAt` (DateTime)

**Estimated Size**: ~2-10 KB per campaign (depends on email template size)

---

#### `CampaignRecipient` Table
**Purpose**: Individual recipients in campaigns  
**Data Stored**:
- `id` (String, CUID)
- `campaignId` (String) - Foreign key to Campaign
- `email` (String) - Recipient email address
- `payload` (JSON) - Merge field data (name, company, etc.)
  - Example: `{ "firstName": "John", "lastName": "Doe", "company": "Acme Inc" }`
- `status` (Enum: PENDING, SENT, FAILED, SUPPRESSED, UNSUBSCRIBED, BOUNCED)
- `lastSentAt` (DateTime, optional)
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~300-500 bytes per recipient  
**Volume**: Can be thousands per campaign

---

#### `MessageLog` Table
**Purpose**: Log of all sent emails  
**Data Stored**:
- `id` (String, CUID)
- `campaignId` (String) - Foreign key to Campaign
- `campaignRecipientId` (String, optional) - Foreign key to CampaignRecipient
- `followUpStepId` (String, optional) - If this is a follow-up email
- `gmailMessageId` (String, optional) - Gmail's message ID
- `subject` (String) - Email subject line
- `to` (String) - Recipient email
- `status` (Enum: PENDING, PROCESSING, SENT, DELIVERED, BOUNCED, FAILED)
- `sendAt` (DateTime, optional) - When email was sent
- `error` (String, optional) - Error message if failed
- `opens` (Int, default 0) - Number of opens
- `clicks` (Int, default 0) - Number of clicks
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~500 bytes per message  
**Volume**: One per email sent (can be millions)

---

#### `TrackingEvent` Table
**Purpose**: Email tracking events (opens, clicks, replies)  
**Data Stored**:
- `id` (String, CUID)
- `messageLogId` (String) - Foreign key to MessageLog
- `type` (Enum: OPEN, CLICK, REPLY, BOUNCE, UNSUBSCRIBE)
- `meta` (JSON, optional) - Additional event data
  - For CLICK: `{ "url": "https://..." }`
  - For REPLY: `{ "threadId": "..." }`
- `createdAt` (DateTime)

**Estimated Size**: ~200-400 bytes per event  
**Volume**: Multiple per message (opens, clicks, etc.)

---

#### `FollowUpSequence` Table
**Purpose**: Follow-up automation sequences  
**Data Stored**:
- `id` (String, CUID)
- `campaignId` (String) - Foreign key to Campaign
- `name` (String) - Sequence name
- `settings` (JSON) - Sequence configuration
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~500 bytes per sequence

---

#### `FollowUpStep` Table
**Purpose**: Individual steps in follow-up sequences  
**Data Stored**:
- `id` (String, CUID)
- `followUpSequenceId` (String) - Foreign key to FollowUpSequence
- `order` (Int) - Step order in sequence
- `offsetConfig` (JSON) - Scheduling configuration
  - `delayMs` (number)
  - `scheduledAt` (ISO string)
  - `sendAsReply` (boolean)
  - `isNested` (boolean)
  - `parentStepId` (string, optional)
- `templateSubject` (String) - Email subject template
- `templateHtml` (String) - Email body HTML (can be large)
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~2-5 KB per step (depends on template size)

---

#### `CampaignFolder` Table
**Purpose**: Campaign organization folders  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Folder owner
- `name` (String) - Folder name
- `color` (String, optional) - Folder color
- `gmailLabelId` (String, optional) - Synced Gmail label ID
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~200 bytes per folder

---

### 3. **Google Sheets Integration**

#### `SheetSource` Table
**Purpose**: Imported Google Sheets for campaigns  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Sheet owner
- `title` (String) - Sheet title
- `spreadsheetId` (String) - Google Sheets ID
- `worksheetId` (String, optional) - Specific worksheet ID
- `columns` (JSON) - Column metadata
  - Example: `[{ "name": "email", "index": 0 }, { "name": "name", "index": 1 }]`
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~500 bytes per sheet source

---

### 4. **Calendar & Meeting Scheduling**

#### `CalendarConnection` Table
**Purpose**: Connected Google Calendar accounts  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Connection owner
- `provider` (Enum: GOOGLE, MICROSOFT, OTHER)
- `accountEmail` (String) - Calendar account email
- `externalAccountId` (String) - External provider ID
- `defaultCalendarId` (String, optional) - Default calendar
- `timeZone` (String, optional) - Timezone
- `accessToken` (String) - OAuth access token (encrypted)
- `refreshToken` (String) - OAuth refresh token (encrypted)
- `scope` (String) - OAuth scopes
- `tokenType` (String) - Token type
- `expiryDate` (DateTime) - Token expiration
- `metadata` (JSON, optional) - Additional connection data
- `createdAt`, `updatedAt` (DateTime)

**Security**: Contains sensitive OAuth tokens

**Estimated Size**: ~1-2 KB per connection

---

#### `CalendarAvailabilityCache` Table
**Purpose**: Cached calendar availability data  
**Data Stored**:
- `id` (String, CUID)
- `calendarConnectionId` (String) - Foreign key to CalendarConnection
- `rangeStart` (DateTime) - Cache start time
- `rangeEnd` (DateTime) - Cache end time
- `busyBlocks` (JSON) - Array of busy time blocks
  - Example: `[{ "start": "2025-01-29T10:00:00Z", "end": "2025-01-29T11:00:00Z" }]`
- `refreshedAt` (DateTime) - Last refresh time
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~1-5 KB per cache entry (depends on busy blocks)

---

#### `MeetingType` Table
**Purpose**: Meeting type definitions  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Meeting type owner
- `calendarConnectionId` (String, optional) - Linked calendar
- `name` (String) - Meeting type name
- `slug` (String, unique) - URL-friendly identifier
- `description` (String, optional) - Description
- `durationMinutes` (Int) - Meeting duration
- `bufferBeforeMinutes` (Int, default 0) - Buffer before meeting
- `bufferAfterMinutes` (Int, default 0) - Buffer after meeting
- `maxBookingsPerDay` (Int, optional) - Daily booking limit
- `availabilityRules` (JSON) - Availability configuration
- `formSchema` (JSON, optional) - Booking form fields
- `meetingLocationType` (Enum: GOOGLE_MEET, PHONE, IN_PERSON, CUSTOM_URL)
- `meetingLocationValue` (String, optional) - Location details
- `isActive` (Boolean, default true)
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~2-5 KB per meeting type

---

#### `CustomAvailabilitySlot` Table
**Purpose**: Custom availability time slots  
**Data Stored**:
- `id` (String, CUID)
- `meetingTypeId` (String) - Foreign key to MeetingType
- `startTime` (DateTime) - Slot start time
- `endTime` (DateTime) - Slot end time
- `isRecurring` (Boolean, default false) - Is recurring slot
- `recurrenceRule` (String, optional) - RRULE format
- `timeZone` (String) - Timezone
- `isActive` (Boolean, default true)
- `notes` (String, optional) - Slot notes
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~300 bytes per slot

---

#### `BookingLink` Table
**Purpose**: Public booking links  
**Data Stored**:
- `id` (String, CUID)
- `meetingTypeId` (String) - Foreign key to MeetingType
- `name` (String, optional) - Link name
- `token` (String, unique) - Unique booking token
- `description` (String, optional) - Link description
- `isPublic` (Boolean, default true) - Is public link
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~200 bytes per link

---

#### `MeetingBooking` Table
**Purpose**: Scheduled meeting bookings  
**Data Stored**:
- `id` (String, CUID)
- `meetingTypeId` (String) - Foreign key to MeetingType
- `bookingLinkId` (String, optional) - Foreign key to BookingLink
- `userId` (String) - Meeting organizer
- `calendarEventId` (String, optional) - Google Calendar event ID
- `conferenceUrl` (String, optional) - Video conference URL
- `startTime` (DateTime) - Meeting start
- `endTime` (DateTime) - Meeting end
- `status` (Enum: PENDING, CONFIRMED, CANCELLED, DECLINED)
- `inviteeEmail` (String) - Attendee email
- `inviteeName` (String, optional) - Attendee name
- `inviteeAnswers` (JSON, optional) - Form responses
- `metadata` (JSON, optional) - Additional booking data
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~500 bytes per booking

---

#### `MeetingReminder` Table
**Purpose**: Meeting reminder emails  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Reminder sender
- `meetingTypeId` (String) - Foreign key to MeetingType
- `bookingLinkId` (String, optional) - Foreign key to BookingLink
- `inviteeEmail` (String) - Reminder recipient
- `inviteeName` (String, optional) - Recipient name
- `status` (Enum: PENDING, SCHEDULED, COMPLETED, CANCELLED, FAILED)
- `sendCount` (Int, default 0) - Number of reminders sent
- `maxSends` (Int, default 2) - Maximum reminders
- `schedulePlanMinutes` (Int[]) - Reminder schedule (minutes before meeting)
- `lastSentAt` (DateTime, optional) - Last reminder sent
- `nextSendAt` (DateTime, optional) - Next reminder scheduled
- `metadata` (JSON, optional) - Additional reminder data
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~400 bytes per reminder

---

### 5. **Email Deliverability & Reputation**

#### `SendingDomain` Table
**Purpose**: Verified sending domains  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Domain owner
- `domain` (String) - Domain name
- `spfRecord` (String, optional) - SPF DNS record
- `spfVerified` (Boolean, default false) - SPF verified
- `dkimSelector` (String, optional) - DKIM selector
- `dkimPublicKey` (String, optional) - DKIM public key
- `dkimPrivateKey` (String, optional) - DKIM private key (encrypted)
- `dkimVerified` (Boolean, default false) - DKIM verified
- `dmarcPolicy` (String, optional) - DMARC policy
- `dmarcVerified` (Boolean, default false) - DMARC verified
- `isVerified` (Boolean, default false) - Overall verification status
- `verificationAt` (DateTime, optional) - Verification timestamp
- `createdAt`, `updatedAt` (DateTime)

**Security**: Contains DKIM private keys (should be encrypted)

**Estimated Size**: ~2-5 KB per domain

---

#### `DomainReputation` Table
**Purpose**: Domain sender reputation scores  
**Data Stored**:
- `id` (String, CUID)
- `sendingDomainId` (String, unique) - Foreign key to SendingDomain
- `bounceRate` (Float, default 0.0) - Bounce percentage
- `complaintRate` (Float, default 0.0) - Complaint percentage
- `openRate` (Float, default 0.0) - Open percentage
- `clickRate` (Float, default 0.0) - Click percentage
- `totalSent` (Int, default 0) - Total emails sent
- `totalDelivered` (Int, default 0) - Total delivered
- `totalBounced` (Int, default 0) - Total bounced
- `totalComplained` (Int, default 0) - Total complaints
- `totalOpened` (Int, default 0) - Total opens
- `totalClicked` (Int, default 0) - Total clicks
- `reputationScore` (Float, default 100.0) - Reputation score (0-100)
- `isInWarmup` (Boolean, default false) - Is in warm-up phase
- `warmupStartedAt` (DateTime, optional) - Warm-up start time
- `lastCalculatedAt` (DateTime) - Last calculation time
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~200 bytes per reputation record

---

#### `EmailBounce` Table
**Purpose**: Email bounce records  
**Data Stored**:
- `id` (String, CUID)
- `sendingDomainId` (String, optional) - Foreign key to SendingDomain
- `messageLogId` (String, optional) - Foreign key to MessageLog
- `recipientEmail` (String) - Bounced email address
- `bounceType` (Enum: HARD, SOFT) - Bounce type
- `bounceCategory` (Enum: INVALID_EMAIL, MAILBOX_FULL, MESSAGE_TOO_LARGE, CONTENT_REJECTED, BLOCKED, OTHER)
- `reason` (String, optional) - Bounce reason
- `rawResponse` (String, optional) - Raw bounce response
- `createdAt` (DateTime)

**Estimated Size**: ~500 bytes per bounce

---

#### `EmailComplaint` Table
**Purpose**: Spam complaint records  
**Data Stored**:
- `id` (String, CUID)
- `sendingDomainId` (String, optional) - Foreign key to SendingDomain
- `messageLogId` (String, optional) - Foreign key to MessageLog
- `recipientEmail` (String) - Complaining email address
- `feedbackType` (String, optional) - Complaint type (e.g., "abuse", "fraud")
- `userAgent` (String, optional) - User agent string
- `createdAt` (DateTime)

**Estimated Size**: ~400 bytes per complaint

---

#### `UnsubscribeRecord` Table
**Purpose**: Unsubscribe records  
**Data Stored**:
- `id` (String, CUID)
- `email` (String) - Unsubscribed email address
- `campaignId` (String, optional) - Foreign key to Campaign
- `sendingDomainId` (String, optional) - Foreign key to SendingDomain
- `reason` (String, optional) - Unsubscribe reason
- `source` (String, optional) - Unsubscribe source ("link", "header", "manual")
- `createdAt` (DateTime)

**Estimated Size**: ~300 bytes per unsubscribe

---

#### `EmailWarmup` Table
**Purpose**: Email warm-up progress tracking  
**Data Stored**:
- `id` (String, CUID)
- `sendingDomainId` (String) - Foreign key to SendingDomain
- `day` (Int) - Day number in warm-up (1, 2, 3, ...)
- `targetVolume` (Int) - Target emails for this day
- `actualVolume` (Int, default 0) - Actual emails sent
- `completedAt` (DateTime, optional) - Completion time
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~200 bytes per warm-up day

---

### 6. **Email Management (Future Features)**

#### `EmailDraft` Table
**Purpose**: Saved email drafts  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Draft owner
- `to` (String) - Recipient email
- `cc` (String, optional) - CC recipients
- `bcc` (String, optional) - BCC recipients
- `subject` (String) - Email subject
- `body` (String) - Plain text body
- `html` (String, optional) - HTML body
- `attachments` (JSON, optional) - Attachment metadata
- `threadId` (String, optional) - Gmail thread ID
- `replyToId` (String, optional) - Reply-to message ID
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~2-10 KB per draft (depends on content)

---

#### `ScheduledEmail` Table
**Purpose**: Scheduled individual emails  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Email sender
- `to` (String) - Recipient email
- `cc` (String, optional) - CC recipients
- `bcc` (String, optional) - BCC recipients
- `subject` (String) - Email subject
- `body` (String) - Plain text body
- `html` (String, optional) - HTML body
- `threadId` (String, optional) - Gmail thread ID
- `scheduledAt` (DateTime) - Scheduled send time
- `timezone` (String, optional) - Timezone
- `status` (Enum: PENDING, SENT, CANCELLED, FAILED)
- `sentAt` (DateTime, optional) - Actual send time
- `error` (String, optional) - Error message
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~2-10 KB per scheduled email

---

#### `EmailTemplate` Table
**Purpose**: Reusable email templates  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Template owner
- `name` (String) - Template name
- `category` (String, optional) - Template category
- `subject` (String) - Subject template
- `body` (String) - Plain text template
- `html` (String, optional) - HTML template
- `variables` (JSON, optional) - Available variables
- `isPublic` (Boolean, default false) - Is public template
- `usageCount` (Int, default 0) - Usage counter
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~2-10 KB per template

---

#### `EmailSnooze` Table
**Purpose**: Snoozed emails  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - User who snoozed
- `messageId` (String) - Gmail message ID
- `threadId` (String, optional) - Gmail thread ID
- `snoozeUntil` (DateTime) - Snooze until time
- `labelIds` (String[]) - Gmail label IDs
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~300 bytes per snooze

---

#### `EmailFilter` Table
**Purpose**: Email filtering rules  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Filter owner
- `name` (String) - Filter name
- `criteria` (JSON) - Filter criteria
- `actions` (JSON) - Filter actions
- `isActive` (Boolean, default true) - Is active
- `matchCount` (Int, default 0) - Number of matches
- `lastMatched` (DateTime, optional) - Last match time
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~1-2 KB per filter

---

### 7. **Team Collaboration**

#### `Team` Table
**Purpose**: Team/organization definitions  
**Data Stored**:
- `id` (String, CUID)
- `name` (String) - Team name
- `description` (String, optional) - Team description
- `ownerId` (String) - Team owner (User ID)
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~300 bytes per team

---

#### `TeamMember` Table
**Purpose**: Team membership  
**Data Stored**:
- `id` (String, CUID)
- `teamId` (String) - Foreign key to Team
- `userId` (String) - Foreign key to User
- `role` (Enum: OWNER, ADMIN, MEMBER)
- `joinedAt` (DateTime) - Join timestamp
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~200 bytes per membership

---

#### `SharedInbox` Table
**Purpose**: Shared team inboxes  
**Data Stored**:
- `id` (String, CUID)
- `teamId` (String) - Foreign key to Team
- `name` (String) - Inbox name
- `description` (String, optional) - Inbox description
- `emailAddress` (String, optional) - Specific email address
- `isActive` (Boolean, default true) - Is active
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~300 bytes per inbox

---

#### `EmailAssignment` Table
**Purpose**: Email assignments to team members  
**Data Stored**:
- `id` (String, CUID)
- `teamId` (String) - Foreign key to Team
- `sharedInboxId` (String, optional) - Foreign key to SharedInbox
- `messageId` (String) - Gmail message ID
- `threadId` (String, optional) - Gmail thread ID
- `assignedToId` (String, optional) - Assigned user
- `assignedById` (String, optional) - User who assigned
- `status` (Enum: UNASSIGNED, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED)
- `priority` (Int, default 0) - Priority level (0=normal, 1=high, 2=urgent)
- `notes` (String, optional) - Assignment notes
- `metadata` (JSON, optional) - Additional data
- `createdAt`, `updatedAt`, `assignedAt`, `resolvedAt` (DateTime)

**Estimated Size**: ~500 bytes per assignment

---

### 8. **Workflow Automation**

#### `Workflow` Table
**Purpose**: Automation workflows  
**Data Stored**:
- `id` (String, CUID)
- `userId` (String) - Workflow owner
- `name` (String) - Workflow name
- `description` (String, optional) - Workflow description
- `trigger` (JSON) - Trigger configuration
- `nodes` (JSON) - Workflow nodes (visual representation)
- `edges` (JSON) - Workflow edges (connections)
- `isActive` (Boolean, default true) - Is active
- `runCount` (Int, default 0) - Execution count
- `lastRunAt` (DateTime, optional) - Last execution time
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~5-20 KB per workflow (depends on complexity)

---

#### `WorkflowExecution` Table
**Purpose**: Workflow execution logs  
**Data Stored**:
- `id` (String, CUID)
- `workflowId` (String) - Foreign key to Workflow
- `status` (Enum: RUNNING, COMPLETED, FAILED, CANCELLED)
- `context` (JSON) - Execution context/data
- `currentNodeId` (String, optional) - Current executing node
- `error` (String, optional) - Error message
- `startedAt` (DateTime) - Start time
- `completedAt` (DateTime, optional) - Completion time
- `createdAt`, `updatedAt` (DateTime)

**Estimated Size**: ~2-10 KB per execution

---

## 📊 Data Volume Estimates

### Per User (Active User)
- **User record**: ~200 bytes
- **OAuth credentials**: ~1 KB
- **Campaigns**: ~10-50 KB (5-10 campaigns)
- **Recipients**: ~500 KB - 5 MB (1,000-10,000 recipients)
- **Message logs**: ~500 KB - 5 MB (1,000-10,000 messages)
- **Tracking events**: ~200 KB - 2 MB (1,000-10,000 events)
- **Calendar connections**: ~2 KB (1-2 connections)
- **Meeting types**: ~10 KB (5 meeting types)
- **Bookings**: ~50 KB (100 bookings)
- **Sending domains**: ~5 KB (1-2 domains)
- **Reputation data**: ~200 bytes per domain

**Total per active user**: ~2-15 MB

### High-Volume User (Enterprise)
- **Campaigns**: ~100-500 KB (50-100 campaigns)
- **Recipients**: ~50-500 MB (100,000-1,000,000 recipients)
- **Message logs**: ~50-500 MB (100,000-1,000,000 messages)
- **Tracking events**: ~20-200 MB (100,000-1,000,000 events)

**Total per enterprise user**: ~100 MB - 1 GB

---

## 🔒 Sensitive Data

### Encrypted/Protected Data:
1. **OAuth Tokens** (`OAuthCredential`, `CalendarConnection`)
   - Access tokens
   - Refresh tokens
   - Should be encrypted at rest

2. **DKIM Private Keys** (`SendingDomain`)
   - Private keys for email signing
   - Must be encrypted

3. **Email Content** (`MessageLog`, `EmailDraft`, `ScheduledEmail`)
   - Contains email subject and body
   - May contain personal information

4. **Recipient Data** (`CampaignRecipient`, `payload` JSON)
   - Email addresses
   - Personal information (names, companies, etc.)

---

## 📈 Growth Projections

### Small Business (100 users)
- **Total data**: ~200 MB - 1.5 GB

### Medium Business (1,000 users)
- **Total data**: ~2 GB - 15 GB

### Enterprise (10,000 users)
- **Total data**: ~20 GB - 150 GB

### High-Volume Enterprise (100,000 users)
- **Total data**: ~200 GB - 1.5 TB

---

## 🗄️ Database Indexes

The schema includes **80+ indexes** for:
- Foreign key lookups
- Status filtering
- Date range queries
- Email address searches
- User-specific queries
- Campaign filtering
- Performance optimization

---

## 📝 Notes

1. **JSON Fields**: Many fields use JSON for flexibility, but this can make queries more complex
2. **Cascade Deletes**: Most relationships use cascade deletes for data cleanup
3. **Timestamps**: All tables include `createdAt` and `updatedAt` for audit trails
4. **Soft Deletes**: Not implemented - data is permanently deleted
5. **Data Retention**: No automatic data retention policies - all data is kept indefinitely

---

**Last Updated**: 2025-01-29  
**Database Version**: PostgreSQL (version varies by deployment)  
**ORM**: Prisma Client


