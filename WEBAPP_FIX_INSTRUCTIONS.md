# How to Fix Webapp and Access Your Site

## The Problem

1. **You're accessing the wrong URL** - `taskforce-backend-production.up.railway.app` is the **backend API**, not your website
2. **Webapp is running backend code** - The webapp service logs show it's running the backend server instead of the Next.js app
3. **Missing database column** - The `threadId` column is missing (being fixed now)

## Solution

### Step 1: Find Your Webapp Service URL

1. Go to **Railway Dashboard**: https://railway.app
2. Open your project (**patient-passion**)
3. Look for a service named **`taskforce-webapp`** or **`webapp`**
   - If you don't see it, you need to create it (see Step 2)
4. Click on the **webapp service**
5. Go to **Settings** tab
6. Look for **"Generate Domain"** button and click it
7. Your webapp URL will be something like: `taskforce-webapp-production.up.railway.app`

### Step 2: Fix Webapp Service Configuration

If the webapp service exists but is running backend code:

1. **Go to webapp service** → **Settings**
2. **Check Root Directory**:
   - Should be: `webapp`
   - If it's `backend` or empty, change it to `webapp`
3. **Check Build Command**:
   - Should be: `npm ci && npm run build`
4. **Check Start Command**:
   - Should be: `npm start` or `next start -p ${PORT:-3000}`
   - Should NOT be: `node dist/server.js` (that's backend)
5. **Save changes**

### Step 3: Create Webapp Service (If It Doesn't Exist)

If you don't have a webapp service:

1. In Railway Dashboard, click **"+ New"** → **"GitHub Repo"**
2. **Select the same repository**
3. **In service settings**:
   - **Name**: `taskforce-webapp`
   - **Root Directory**: `webapp`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
4. **Add Environment Variables**:
   - `NODE_ENV` = `production`
   - `NEXT_PUBLIC_API_URL` = `https://taskforce-backend-production.up.railway.app`
   - `PORT` = `3000` (or leave Railway to auto-assign)
5. **Deploy**

### Step 4: Verify Webapp is Running Correctly

After fixing, check the webapp logs. You should see:
- ✅ `next start` or Next.js messages
- ✅ No `backend@1.0.0` messages
- ✅ No `node dist/server.js` messages

### Step 5: Access Your Site

Once the webapp is running correctly:
- ✅ **Use the webapp URL**: `https://taskforce-webapp-production.up.railway.app`
- ❌ **Don't use the backend URL**: `https://taskforce-backend-production.up.railway.app` (this is just the API)

## Quick Checklist

- [ ] Webapp service exists in Railway
- [ ] Webapp Root Directory = `webapp`
- [ ] Webapp Start Command = `npm start` (not `node dist/server.js`)
- [ ] `NEXT_PUBLIC_API_URL` variable set to backend URL
- [ ] Webapp domain generated
- [ ] Access webapp URL (not backend URL)

## What Each Service Does

- **Backend** (`taskforce-backend`): API server - handles data, authentication, etc.
- **Webapp** (`taskforce-webapp`): Your actual website - the user interface

You need BOTH services running, but you access the **webapp** URL to use the site!

