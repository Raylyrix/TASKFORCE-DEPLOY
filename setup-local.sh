#!/bin/bash
# Local Development Setup Script for Linux/Mac

echo "🚀 Setting up TaskForce Wallet for local development..."

# Check Node.js
echo ""
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node --version) found"

# Setup Backend
echo ""
echo "🔧 Setting up backend..."
cd wallet-backend

if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wallet_db?schema=public"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Server
PORT=4000
NODE_ENV=development

# JWT Authentication
JWT_SECRET="dev-jwt-secret-change-in-production-$(openssl rand -hex 16)"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="dev-encryption-key-32chars"

# CORS
CORS_ORIGIN="http://localhost:3002"
EOF
    echo "✅ Created .env file"
else
    echo "✅ .env file already exists"
fi

echo "Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend npm install failed"
    exit 1
fi

echo "Generating Prisma client..."
npm run prisma:generate
if [ $? -ne 0 ]; then
    echo "❌ Prisma generate failed"
    exit 1
fi

echo "✅ Backend setup complete"

# Setup Frontend
echo ""
echo "🔧 Setting up frontend..."
cd ../wallet-frontend

if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    echo 'NEXT_PUBLIC_API_URL="http://localhost:4000"' > .env.local
    echo "✅ Created .env.local file"
else
    echo "✅ .env.local file already exists"
fi

echo "Installing frontend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend npm install failed"
    exit 1
fi

echo "✅ Frontend setup complete"

# Summary
echo ""
echo "✨ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Set up PostgreSQL database:"
echo "   - Create database: CREATE DATABASE wallet_db;"
echo "   - Update DATABASE_URL in wallet-backend/.env"
echo ""
echo "2. Run database migrations:"
echo "   cd wallet-backend"
echo "   npm run prisma:migrate"
echo ""
echo "3. Start backend (in wallet-backend/):"
echo "   npm run dev"
echo ""
echo "4. Start frontend (in wallet-frontend/):"
echo "   npm run dev"
echo ""
echo "🌐 Frontend: http://localhost:3002"
echo "🔌 Backend: http://localhost:4000"

cd ..

