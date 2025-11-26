# TaskForce Web Application

A comprehensive CRM web application for managing email campaigns, calendar, meetings, and follow-ups with AI-powered features.

## Features

- 🔐 **Gmail OAuth Authentication** - Secure login with Google
- 📊 **Dashboard** - Analytics overview with charts and metrics
- 📧 **Campaign Management** - Create, view, pause, resume, and cancel email campaigns
- 📅 **Calendar Integration** - Manage calendar connections and meeting types
- 📨 **Email Client** - Read and manage Gmail with better UX than Gmail
- 🤖 **AI Integration** - Powered by Ollama/Mistral for email summarization and smart suggestions
- 📈 **Follow-up Sequences** - Automate follow-up email sequences

## Prerequisites

- Node.js 20+
- Backend API running (see `../backend/README.md`)
- Ollama with Mistral model installed and running (optional, for AI features)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:
   - `NEXT_PUBLIC_API_URL` - Backend API URL (default: `http://localhost:3000`)
   - `NEXT_PUBLIC_OLLAMA_URL` - Ollama API URL (default: `http://localhost:11434`)

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3001`

## Ollama Setup (Optional)

For AI features to work, you need Ollama installed and running:

1. **Install Ollama:**
   - Visit [ollama.ai](https://ollama.ai) and follow installation instructions

2. **Pull Mistral model:**
   ```bash
   ollama pull mistral:instruct
   ```

3. **Start Ollama server:**
   ```bash
   ollama serve
   ```

   The server will run on `http://localhost:11434` by default.

## Project Structure

```
webapp/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── dashboard/    # Dashboard page
│   │   ├── campaigns/    # Campaign management
│   │   ├── calendar/     # Calendar & meetings
│   │   ├── emails/       # Email client
│   │   ├── follow-ups/   # Follow-up sequences
│   │   └── login/        # Authentication
│   ├── components/       # React components
│   └── lib/              # Utilities & API client
├── public/               # Static assets
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## AI Features

The application includes AI-powered features using Ollama/Mistral:

- **Email Summarization** - Click the sparkle icon (✨) on any email to get an AI-generated summary
- **Reply Suggestions** - Get AI-suggested replies to emails (coming soon)
- **Campaign Analysis** - AI-powered insights on campaign performance (coming soon)

## Development

### Authentication Flow

1. User clicks "Continue with Google" on login page
2. Redirects to Google OAuth consent screen
3. After consent, redirects to `/auth/callback`
4. Backend exchanges code for tokens
5. User info stored in localStorage
6. Redirect to dashboard

### API Integration

The app uses the backend API at `NEXT_PUBLIC_API_URL`. All API calls go through `/api/*` which is proxied to the backend.

### State Management

- React Query for server state
- LocalStorage for auth state
- Zustand can be added for global client state if needed

## Production Build

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

Or deploy to Vercel, Netlify, or your preferred hosting platform.

## License

ISC

