# Local Development Setup Script for Windows PowerShell

Write-Host "🚀 Setting up TaskForce Wallet for local development..." -ForegroundColor Cyan

# Check Node.js
Write-Host "`n📦 Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js 20+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green

# Setup Backend
Write-Host "`n🔧 Setting up backend..." -ForegroundColor Yellow
Set-Location wallet-backend

if (-not (Test-Path .env)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    @"
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wallet_db?schema=public"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Server
PORT=4000
NODE_ENV=development

# JWT Authentication
JWT_SECRET="dev-jwt-secret-change-in-production-$(Get-Random)"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="dev-encryption-key-32chars"

# CORS
CORS_ORIGIN="http://localhost:3002"
"@ | Out-File -FilePath .env -Encoding utf8
    Write-Host "✅ Created .env file" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend npm install failed" -ForegroundColor Red
    exit 1
}

Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prisma generate failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend setup complete" -ForegroundColor Green

# Setup Frontend
Write-Host "`n🔧 Setting up frontend..." -ForegroundColor Yellow
Set-Location ..\wallet-frontend

if (-not (Test-Path .env.local)) {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    @"
NEXT_PUBLIC_API_URL="http://localhost:4000"
"@ | Out-File -FilePath .env.local -Encoding utf8
    Write-Host "✅ Created .env.local file" -ForegroundColor Green
} else {
    Write-Host "✅ .env.local file already exists" -ForegroundColor Green
}

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend npm install failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Frontend setup complete" -ForegroundColor Green

# Summary
Write-Host "`n✨ Setup complete!" -ForegroundColor Cyan
Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Set up PostgreSQL database:" -ForegroundColor White
Write-Host "   - Create database: CREATE DATABASE wallet_db;" -ForegroundColor Gray
Write-Host "   - Update DATABASE_URL in wallet-backend/.env" -ForegroundColor Gray
Write-Host "`n2. Run database migrations:" -ForegroundColor White
Write-Host "   cd wallet-backend" -ForegroundColor Gray
Write-Host "   npm run prisma:migrate" -ForegroundColor Gray
Write-Host "`n3. Start backend (in wallet-backend/):" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host "`n4. Start frontend (in wallet-frontend/):" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host "`n🌐 Frontend: http://localhost:3002" -ForegroundColor Cyan
Write-Host "🔌 Backend: http://localhost:4000" -ForegroundColor Cyan

Set-Location ..

