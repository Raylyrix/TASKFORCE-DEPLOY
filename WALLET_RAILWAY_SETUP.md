# Wallet Services - Railway Setup Guide

## ✅ Code Status
- ✅ Code pushed to GitHub
- ✅ TypeScript errors fixed
- ✅ Dockerfiles ready
- ✅ Railway configs ready

## 🚀 Next Steps - Create Services in Railway Dashboard

### Step 1: Create wallet-backend Service
1. Go to Railway dashboard → **patient-passion** project
2. Click **"New Service"** → **"GitHub Repo"**
3. Select your repository: `TASKFORCE-DEPLOY`
4. Configure:
   - **Root Directory**: `wallet-backend`
   - **Service Name**: `wallet-backend`
   - **Build Command**: (auto-detected from Dockerfile)
   - **Start Command**: `node dist/server.js`

### Step 2: Create wallet-frontend Service
1. In same project, click **"New Service"** → **"GitHub Repo"**
2. Select repository: `TASKFORCE-DEPLOY`
3. Configure:
   - **Root Directory**: `wallet-frontend`
   - **Service Name**: `wallet-frontend`
   - **Build Command**: (auto-detected from Dockerfile)
   - **Start Command**: `node server.js`

### Step 3: Create wallet-db (Optional - or use existing taskforce-db)
1. Click **"New Service"** → **"Database"** → **"PostgreSQL"**
2. Service Name: `wallet-db`
3. Railway will auto-generate `DATABASE_URL`

### Step 4: Set Environment Variables

#### wallet-backend Service:
```
DATABASE_URL=<from wallet-db or taskforce-db>
PORT=4000
NODE_ENV=production
JWT_SECRET=<generate-random-secret>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-character-random-key>
CORS_ORIGIN=<wallet-frontend-url>
```

#### wallet-frontend Service:
```
NEXT_PUBLIC_API_URL=<wallet-backend-railway-url>
```

### Step 5: Run Database Migrations
After wallet-backend is deployed:
```bash
cd wallet-backend
railway link --project patient-passion --service wallet-backend
railway run npx prisma migrate deploy
```

### Step 6: Generate Domain URLs
- In Railway dashboard, for each service:
  - Click service → **Settings** → **Generate Domain**
  - Copy the URL and use for CORS_ORIGIN and NEXT_PUBLIC_API_URL

## 🔍 Verify Deployment

1. Check wallet-backend health: `https://wallet-backend-url/health`
2. Check wallet-frontend: `https://wallet-frontend-url`
3. Test API endpoints
4. Monitor logs in Railway dashboard

## 📝 Current Status
- ✅ Code ready in GitHub
- ✅ Build should succeed (TypeScript fixed)
- ⏳ Waiting for service creation in Railway dashboard

---

**After creating services, the deployment will auto-trigger from GitHub!**

