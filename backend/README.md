## Backend Service

Node.js + TypeScript service providing APIs, scheduling orchestration, and data persistence for the Gmail campaign extension.

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- Google Cloud OAuth credentials with Gmail API & Sheets API enabled

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `env.example` to `.env` and populate values.
3. Apply database migrations:
   ```bash
   npm run prisma:migrate
   ```
4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Scripts
- `npm run dev` – start API with watch mode
- `npm run build` – compile TypeScript into `dist`
- `npm run start` – launch compiled server
- `npm run lint` – run ESLint with type-checking rules
- `npm run prisma:migrate` – create or apply Prisma migrations
- `npm run prisma:studio` – open Prisma Studio

### Key API Endpoints
- `POST /api/auth/google/start` – returns a consent URL + state token
- `POST /api/auth/google/exchange` – exchanges an OAuth code for stored credentials and user profile
- `POST /api/sheets/import` – imports recipients from a Google Sheet using the stored Google credentials (expects header `X-User-Id`)
- `POST /api/campaigns` – creates a campaign with custom templates, delays, and recipients
- `POST /api/campaigns/:id/schedule` – schedules dispatch with queue-backed delivery
- `POST /api/follow-ups` – defines follow-up sequences with per-step delays and templates
- `GET /api/tracking/pixel/:messageLogId` – transparent pixel endpoint for open tracking

### Folder Structure
- `src/` – TypeScript source files
- `prisma/` – database schema and migrations
- `dist/` – compiled JavaScript output
- `env.example` – sample environment variables

### Health Check
- `GET /health` – returns service status and environment metadata
- `GET /api/health` – same payload routed through modular router

