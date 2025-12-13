# TaskForce Wallet - Deployment Guide

## ✅ What's Been Built

### Backend (`wallet-backend/`)
- ✅ Complete Express.js API with TypeScript
- ✅ Multi-chain wallet support (Ethereum, Solana, Bitcoin)
- ✅ Payment processing with escrow
- ✅ Exchange rate integration
- ✅ Merchant system
- ✅ Authentication & authorization
- ✅ Database schema (Prisma)
- ✅ Dockerfile for deployment
- ✅ Railway configuration

### Frontend (`wallet-frontend/`)
- ✅ Next.js 14 application
- ✅ Authentication pages (Login/Register)
- ✅ Wallet dashboard
- ✅ Send crypto functionality
- ✅ Payment/QR code interface
- ✅ Settings page
- ✅ Responsive design with Tailwind CSS
- ✅ Dockerfile for deployment
- ✅ Railway configuration

## 🚀 Deployment Steps

### Option 1: Railway Dashboard (Recommended)

1. **Create New Services in Railway:**
   - Go to Railway dashboard
   - Open the "taskforce-wallet" project (or create new project)
   - Click "New Service" → "GitHub Repo"
   - Connect your GitHub repository
   - Create two services:
     - `wallet-backend` (point to `wallet-backend/` directory)
     - `wallet-frontend` (point to `wallet-frontend/` directory)

2. **Set Environment Variables for Backend:**
   ```
   DATABASE_URL=<your-postgres-url>
   PORT=4000
   NODE_ENV=production
   JWT_SECRET=<generate-secure-secret>
   JWT_EXPIRES_IN=7d
   ENCRYPTION_KEY=<32-character-key>
   CORS_ORIGIN=<frontend-url>
   ETHEREUM_RPC_URL=<optional>
   SOLANA_RPC_URL=<optional>
   BITCOIN_RPC_URL=<optional>
   ```

3. **Set Environment Variables for Frontend:**
   ```
   NEXT_PUBLIC_API_URL=<backend-url>
   ```

4. **Run Database Migrations:**
   - In Railway, add a one-off service or use Railway CLI:
   ```bash
   cd wallet-backend
   railway run npx prisma migrate deploy
   ```

### Option 2: Railway CLI

1. **Deploy Backend:**
   ```bash
   cd wallet-backend
   railway link  # Link to wallet-backend service
   railway up
   ```

2. **Deploy Frontend:**
   ```bash
   cd wallet-frontend
   railway link  # Link to wallet-frontend service
   railway up
   ```

## 📋 Pre-Deployment Checklist

- [ ] Create PostgreSQL database in Railway
- [ ] Set all environment variables
- [ ] Run Prisma migrations
- [ ] Test backend health endpoint: `/health`
- [ ] Verify CORS settings
- [ ] Check frontend API URL configuration

## 🔍 Monitoring & Logs

After deployment, monitor logs:

```bash
# Backend logs
railway logs --service wallet-backend

# Frontend logs
railway logs --service wallet-frontend
```

Or use Railway dashboard to view logs in real-time.

## 🐛 Common Issues & Fixes

### Issue: Database Connection Failed
- **Fix**: Verify `DATABASE_URL` is set correctly
- **Fix**: Ensure database is accessible from Railway

### Issue: Build Fails
- **Fix**: Check Dockerfile paths
- **Fix**: Verify all dependencies in package.json

### Issue: CORS Errors
- **Fix**: Set `CORS_ORIGIN` to frontend URL
- **Fix**: Check frontend `NEXT_PUBLIC_API_URL`

### Issue: Prisma Client Not Found
- **Fix**: Run `npx prisma generate` before build
- **Fix**: Ensure Prisma schema is copied in Dockerfile

## 📝 Next Steps After Deployment

1. Test authentication endpoints
2. Create test wallets
3. Test payment flow
4. Set up monitoring/alerts
5. Configure custom domains

## 🔗 API Endpoints

### Backend (Port 4000)
- `GET /health` - Health check
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/wallets` - List wallets
- `POST /api/wallets` - Create wallet
- `POST /api/payments` - Create payment
- `GET /api/exchange/rates` - Get exchange rates

### Frontend (Port 3000)
- `/` - Home (redirects to login/dashboard)
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Wallet dashboard
- `/send` - Send crypto
- `/payments` - Payment interface
- `/settings` - Settings

---

**Status**: ✅ Ready for deployment
**Last Updated**: 2025-01-XX

