# Wallet Platform Deployment Checklist

## ✅ Current Status

### Backend (wallet-backend)
- ✅ Code built and pushed
- ✅ Dockerfile configured
- ⚠️ **DATABASE_URL missing** - NEEDS TO BE SET
- ✅ Other environment variables set
- ⚠️ Database migrations need to run

### Frontend (wallet-frontend)
- ✅ Code built and pushed
- ✅ Dockerfile configured
- ✅ Health endpoint added
- ⚠️ **NEXT_PUBLIC_API_URL needs to be set** after backend is deployed

---

## 🔧 Required Actions

### 1. Set DATABASE_URL for wallet-backend

The backend needs the database connection string. Railway should provide this automatically, but if not:

**Option A: Use Railway's automatic DATABASE_URL**
- Railway should automatically inject `DATABASE_URL` when services are linked
- Check if `POSTGRES_URL` is available from wallet-db service

**Option B: Manual setup**
```bash
# Get the connection string from wallet-db service
# Format: postgresql://user:password@host:port/database
```

**Set via Railway CLI:**
```bash
railway variables set DATABASE_URL="postgresql://..." --service wallet-backend
```

Or set in Railway dashboard:
1. Go to wallet-backend service
2. Variables tab
3. Add `DATABASE_URL` with the PostgreSQL connection string

---

### 2. Set CORS_ORIGIN for wallet-backend

After frontend is deployed, set:
```bash
CORS_ORIGIN=https://wallet-frontend-production-4bd6.up.railway.app
```

---

### 3. Set NEXT_PUBLIC_API_URL for wallet-frontend

After backend is deployed and healthy:
```bash
NEXT_PUBLIC_API_URL=https://wallet-backend-production-5ded.up.railway.app
```

---

### 4. Run Database Migrations

The Dockerfile now includes automatic migration on startup. But you can also run manually:

```bash
# Connect to wallet-backend service
railway run --service wallet-backend -- npx prisma migrate deploy
```

---

## 📋 Environment Variables Summary

### wallet-backend
- ✅ DATABASE_URL - **NEEDS TO BE SET** (from wallet-db)
- ✅ REDIS_URL - Already set
- ✅ JWT_SECRET - Already set
- ✅ ENCRYPTION_KEY - Already set
- ✅ PORT - Already set (4000)
- ✅ NODE_ENV - Already set (production)
- ⚠️ CORS_ORIGIN - Set after frontend deployed

### wallet-frontend
- ⚠️ NEXT_PUBLIC_API_URL - Set after backend deployed

---

## 🚀 Deployment Steps

1. **Set DATABASE_URL** for wallet-backend
   - This will allow the backend to start
   - Migrations will run automatically on startup

2. **Wait for backend to be healthy**
   - Check health endpoint: `https://wallet-backend-production-5ded.up.railway.app/health`
   - Should return: `{"status":"ok","service":"taskforce-wallet-api"}`

3. **Set CORS_ORIGIN** for wallet-backend
   - Use frontend URL: `https://wallet-frontend-production-4bd6.up.railway.app`

4. **Set NEXT_PUBLIC_API_URL** for wallet-frontend
   - Use backend URL: `https://wallet-backend-production-5ded.up.railway.app`

5. **Redeploy both services** (or wait for auto-deploy)

6. **Test the application**
   - Frontend: `https://wallet-frontend-production-4bd6.up.railway.app`
   - Backend: `https://wallet-backend-production-5ded.up.railway.app/health`

---

## 🧪 Testing Checklist

- [ ] Backend health check works
- [ ] Frontend loads without errors
- [ ] User can register
- [ ] User can login
- [ ] User can create wallet
- [ ] User can view wallet balance
- [ ] User can send crypto
- [ ] User can make payment with QR code
- [ ] QR code scanner works (on mobile/desktop with camera)

---

## 🐛 Troubleshooting

### Backend healthcheck failing
- Check DATABASE_URL is set
- Check database is accessible
- Check logs: `railway logs --service wallet-backend`

### Frontend build failing
- Check NEXT_PUBLIC_API_URL is set
- Check build logs for errors

### Database connection errors
- Verify DATABASE_URL format
- Check wallet-db service is running
- Verify network connectivity between services

---

## 📝 Notes

- Database migrations run automatically on backend startup
- Frontend uses Next.js standalone output for optimized deployment
- QR code scanner requires camera permissions (works best on mobile)
- All environment variables are set via Railway dashboard or CLI

