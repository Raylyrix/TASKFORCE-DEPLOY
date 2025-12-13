# Quick Deploy - Wallet Services

## ✅ What's Ready:
- ✅ Code pushed to GitHub
- ✅ Redis caching integrated
- ✅ TypeScript errors fixed
- ✅ Dockerfiles ready

## 🚀 Fastest Way to Deploy:

### Option 1: Railway Dashboard (5 minutes)
1. Go to Railway → **patient-passion** project
2. Click **"New Service"** → **"GitHub Repo"**
3. Select: `TASKFORCE-DEPLOY`
4. Set **Root Directory**: `wallet-backend`
5. Railway auto-detects Dockerfile and deploys!

Repeat for `wallet-frontend` with root: `wallet-frontend`

### Option 2: Use Existing Infrastructure
Since we're in the same project, we can:
- **Use existing `taskforce-redis`** for wallet caching
- **Create new `wallet-db`** OR use existing `taskforce-db` with different schema
- **No Kafka needed initially** (can add later if needed)

## Environment Variables:

### wallet-backend:
```
DATABASE_URL=<from wallet-db or taskforce-db>
REDIS_URL=<from taskforce-redis or new wallet-redis>
PORT=4000
JWT_SECRET=<random-secret>
ENCRYPTION_KEY=<32-char-key>
CORS_ORIGIN=<wallet-frontend-url>
```

### wallet-frontend:
```
NEXT_PUBLIC_API_URL=<wallet-backend-url>
```

## After Services Created:
Deployment will auto-trigger from GitHub! 🎉

