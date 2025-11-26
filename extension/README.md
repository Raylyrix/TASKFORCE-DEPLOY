## TaskForce Chrome Extension

Manifest V3 Chrome extension that injects a TaskForce campaign workspace directly into Gmail. It delivers a custom composer, Google Sheets recipient import, follow-up orchestration, and live campaign telemetry powered by the backend service.

### Scripts
- `npm run dev` – rebuild on change and copy static assets to `dist/`
- `npm run build` – generate production bundles in `dist/`
- `npm run lint` – TypeScript-aware linting using ESLint
- `npm run format` – Verify code formatting with Prettier

### Key Features
- Detects Gmail automatically and renders a floating campaign workspace.
- OAuth handshake via background service worker using the backend `/api/auth` endpoints.
- Imports Google Sheets recipients and schedules campaigns (using `/api/campaigns`).
- Configures follow-up sequences and logs engagement analytics (via `/api/follow-ups` and `/api/campaigns/:id`).
- Options page to configure the backend base URL, popup to show quick campaign status.

### Default Configuration
- Backend base URL defaults to `http://localhost:3000`
- Manifest host permissions include `http://localhost:3000/*`
- Update the Options page or `public/manifest.json` if the backend is hosted elsewhere

### Folder Overview
- `src/background` – Service worker handling auth, config, and messaging.
- `src/content` – React application injected into Gmail.
- `src/options` – Settings page for backend configuration.
- `src/popup` – Browser action popup surface.
- `public/` – Manifest, HTML shells, icons, copied verbatim to the build output.

### Load Into Chrome
1. Run `npm run build` to produce the `dist/` directory.
2. Open `chrome://extensions`, enable *Developer mode*, choose *Load unpacked*, and select the `dist/` folder.


