# Extension Authentication Fix

## Problem
After authenticating, the extension was stuck at "connecting" because:
1. Backend wasn't detecting extension requests correctly
2. Backend was redirecting to webapp instead of serving extension callback
3. Extension couldn't extract auth code from redirected URL

## Solution

### 1. Improved Extension Detection
Backend now better detects extension requests by checking:
- Referer is from Google (OAuth flow) or missing
- Not from webapp domain

### 2. Extension Can Extract Code from Any URL
Extension now monitors for callback URLs in:
- Backend callback: `/api/auth/google/callback`
- Webapp callback: `/auth/callback` (fallback)

### 3. Backend Keeps Code/State in URL
For extension requests, backend serves a page that keeps the code/state in the URL so extension can extract it.

## What Changed

**Backend (`backend/src/routes/modules/auth.ts`):**
- Improved `isExtension` detection logic
- Extension callback page keeps code/state in URL

**Extension (`extension/src/background/index.ts`):**
- Now checks both backend and webapp callback URLs
- Can extract code/state even if redirected

## Testing

1. Reload extension in Chrome
2. Click "Connect Google Account"
3. Complete OAuth flow
4. Extension should detect callback and complete authentication
5. Tab should close automatically

## If Still Not Working

1. Check browser console for errors
2. Verify backend is deployed with latest changes
3. Check extension background script logs (chrome://extensions → TaskForce → Inspect views: service worker)


