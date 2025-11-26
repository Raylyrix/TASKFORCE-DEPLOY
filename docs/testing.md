# Testing & Verification Guide

This project ships a Node.js backend and a Chrome extension that work together to orchestrate Gmail campaigns. Use the following checklist to validate changes before shipping.

## Backend

1. **Environment**
   - Copy `backend/env.example` to `backend/.env` and adjust connection strings for Postgres + Redis (defaults target `postgres://postgres:rayvical@localhost:5432/taskforce`).
   - Ensure Google OAuth credentials (client id/secret) and redirect URI (`http://localhost:3000/api/auth/google/callback`) match what is configured in Google Cloud.
2. **Database**
   - Run `npm run prisma:migrate` inside `backend/` to apply schema migrations.
   - Run `npm run prisma:generate` after editing `prisma/schema.prisma`.
3. **Static analysis**
   - `npm run lint`
   - `npm run build` (produces `dist/` and catches TypeScript issues).
4. **Smoke tests**
   - Start services: `npm run dev`.
   - `GET /health` returns `{ status: "ok" }`.
   - `POST /api/auth/google/start` returns an auth URL (`200`).
   - With a valid user session, `POST /api/sheets/import` imports a sample Google Sheet, and `POST /api/campaigns` followed by `POST /api/campaigns/:id/schedule` enqueues jobs in Redis (verify via `bullmq` UI or Redis CLI).
   - `GET /api/campaigns/:id` returns metrics after jobs execute.

## Chrome Extension

1. **Build**
   - Inside `extension/`, run `npm run build` to populate `dist/` (defaults expect backend `http://localhost:3000`).
   - Lint with `npm run lint`.
2. **Load**
   - Open `chrome://extensions`, enable Developer Mode, select *Load unpacked*, point to `extension/dist/`.
3. **Auth flow**
   - In the extension popup or Gmail overlay, click “Connect Google Account”.
   - Confirm the background worker exchanges the OAuth code and the overlay switches to the campaign tabs.
4. **Composer UI**
   - Provide a Google Sheet link, ensure columns populate, and launch a campaign. Validate jobs appear in Redis and Gmail draft/mailboxes reflect the sent messages.
   - Toggling scheduling values updates the API payload (check network tab in DevTools).
5. **Follow-ups & Tracking**
   - Create a follow-up sequence, confirm persistence via `GET /api/follow-ups/:campaignId`.
   - Opening a tracked email triggers `GET /api/tracking/pixel/:messageId` and increments open counters.
6. **Options & Popup**
   - Options page updates backend URL.
   - Popup shows the authenticated user and campaign counts.

## Monitoring & Recurring Mistakes

- Consult `docs/recurring-mistakes.log` before starting new feature work.
- Update the log whenever the same regression occurs more than twice, noting mitigation steps.
- Ensure CI covers:
  - Backend lint (`npm run lint`).
  - Backend build (`npm run build`).
  - Extension lint + build (`npm run lint`, `npm run build`).


