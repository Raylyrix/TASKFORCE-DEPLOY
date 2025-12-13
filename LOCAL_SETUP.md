# Local Development Setup Guide

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 14+ installed and running
- Redis (optional, for caching)
- npm or yarn

## Quick Start

### 1. Backend Setup

```bash
cd wallet-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your local database credentials
# Update DATABASE_URL with your PostgreSQL connection string

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Backend will run on `http://localhost:4000`

### 2. Frontend Setup

```bash
cd wallet-frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local - NEXT_PUBLIC_API_URL should be http://localhost:4000

# Start development server
npm run dev
```

Frontend will run on `http://localhost:3002`

## Database Setup

### Using Docker (Recommended)

```bash
# Start PostgreSQL
docker run --name wallet-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=wallet_db \
  -p 5432:5432 \
  -d postgres:14

# Start Redis (optional)
docker run --name wallet-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

### Using Local PostgreSQL

1. Create database:
```sql
CREATE DATABASE wallet_db;
```

2. Update `.env` with your connection string:
```
DATABASE_URL="postgresql://username:password@localhost:5432/wallet_db?schema=public"
```

## Environment Variables

### Backend (.env)

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens (generate random string)
- `ENCRYPTION_KEY` - 32 character key for encryption

Optional:
- `REDIS_URL` - Redis connection (for caching)
- `PORT` - Server port (default: 4000)
- `CORS_ORIGIN` - Frontend URL (default: http://localhost:3002)

### Frontend (.env.local)

Required:
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:4000)

## Running Migrations

```bash
cd wallet-backend

# Create a new migration
npm run prisma:migrate

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## Testing the Setup

1. **Backend Health Check:**
   ```bash
   curl http://localhost:4000/health
   ```
   Should return: `{"status":"ok","service":"taskforce-wallet-api"}`

2. **Frontend:**
   Open `http://localhost:3002` in browser
   Should show login page

3. **Register a User:**
   - Go to `/register`
   - Create an account
   - Should redirect to dashboard

4. **Create a Wallet:**
   - After login, go to dashboard
   - Click "Create Wallet"
   - Select a blockchain (Ethereum, Solana, or Bitcoin)

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL format in .env
- Ensure database exists: `psql -l | grep wallet_db`

### Prisma Issues

- Regenerate Prisma client: `npm run prisma:generate`
- Reset database (WARNING: deletes all data): `npx prisma migrate reset`

### Port Already in Use

- Backend: Change `PORT` in `.env`
- Frontend: Change port in `package.json` dev script or use `-p` flag

### Redis Connection Issues

- Redis is optional - backend will work without it (caching disabled)
- To disable Redis warnings, remove `REDIS_URL` from `.env`

## Development Workflow

1. **Backend changes:**
   - Edit files in `wallet-backend/src/`
   - Server auto-reloads with `npm run dev`
   - Run `npm run build` to check for TypeScript errors

2. **Frontend changes:**
   - Edit files in `wallet-frontend/src/`
   - Next.js auto-reloads with `npm run dev`
   - Run `npm run type-check` to check for TypeScript errors

3. **Database changes:**
   - Edit `wallet-backend/prisma/schema.prisma`
   - Run `npm run prisma:migrate` to create migration
   - Migration will be applied automatically in dev mode

## Next Steps

Once local setup is working:
1. Test all features (register, login, create wallet, send crypto, payments)
2. Fix any bugs
3. Then proceed with Railway deployment

