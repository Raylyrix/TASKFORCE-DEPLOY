# Wallet Services Setup in TaskForce Project

## Current Project: patient-passion
- taskforce-db (PostgreSQL)
- taskforce-webapp (Frontend)
- taskforce-redis (Redis)
- taskforce-backend (Backend API)

## New Services to Add:
1. **wallet-backend** - Wallet API service
2. **wallet-frontend** - Wallet web app
3. **wallet-db** (optional) - Separate database for wallet, OR use existing taskforce-db

## Deployment Steps:

### Option 1: Use Existing Database (Recommended)
- Use `taskforce-db` with different schema
- Set `DATABASE_URL` to existing database
- Run migrations in separate schema

### Option 2: Create New Database
- Add new PostgreSQL service: `wallet-db`
- Use separate database for wallet data

## Environment Variables Needed:

### wallet-backend:
```
DATABASE_URL=<from taskforce-db or new wallet-db>
PORT=4000
NODE_ENV=production
JWT_SECRET=<generate-secure-secret>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-character-key>
CORS_ORIGIN=<wallet-frontend-url>
```

### wallet-frontend:
```
NEXT_PUBLIC_API_URL=<wallet-backend-url>
```

## Next Steps:
1. Deploy wallet-backend service
2. Deploy wallet-frontend service
3. Run Prisma migrations
4. Test endpoints

