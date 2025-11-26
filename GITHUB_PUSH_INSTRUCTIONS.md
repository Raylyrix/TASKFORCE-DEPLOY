# 🔐 GitHub Push Instructions - Fix Authentication

## The Issue
You're getting a `403 Permission denied` error because Git needs authentication.

## Solution: Use Personal Access Token

### Step 1: Create Personal Access Token

1. Go to GitHub.com → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. **Note:** `Taskforce Deploy`
4. **Expiration:** 90 days (or your preference)
5. **Scopes:** Check these:
   - ✅ `repo` (Full control of private repositories)
6. Click **Generate token**
7. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

### Step 2: Push Using Token

**Option A: Use Token in URL (One-time)**

```powershell
cd "C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main"
git remote set-url origin https://YOUR_TOKEN@github.com/Raylyrix/TASKFORCE-DEPLOY.git
git push -u origin main
```

Replace `YOUR_TOKEN` with your actual token.

**Option B: Use Git Credential Manager (Recommended)**

When you push, Git will prompt for credentials:
- **Username:** `Raylyrix`
- **Password:** Paste your Personal Access Token (NOT your GitHub password)

### Step 3: Alternative - Use GitHub CLI

If you have GitHub CLI installed:

```powershell
gh auth login
gh repo set-default Raylyrix/TASKFORCE-DEPLOY
git push -u origin main
```

---

## Quick Push Command

After getting your token, run:

```powershell
cd "C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main"
git push -u origin main
```

When prompted:
- **Username:** `Raylyrix`
- **Password:** `<paste your token here>`

---

## If You Still Get Errors

1. **Clear cached credentials:**
   ```powershell
   git credential-manager-core erase
   ```

2. **Try SSH instead:**
   ```powershell
   git remote set-url origin git@github.com:Raylyrix/TASKFORCE-DEPLOY.git
   ```
   (Requires SSH key setup)

3. **Check repository permissions:**
   - Make sure you have write access to `Raylyrix/TASKFORCE-DEPLOY`
   - Repository must exist and you must be a collaborator

---

## After Successful Push

Once pushed, you can deploy to Render using the guide in `DEPLOY_TO_RENDER.md`!



