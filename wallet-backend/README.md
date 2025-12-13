# TaskForce Wallet & Payments Backend

Complete backend system for TaskForce Wallet - a multi-chain crypto wallet with built-in payment processing.

## Features

- ✅ Multi-chain wallet support (Ethereum, Solana, Bitcoin)
- ✅ Secure key management with encryption
- ✅ User authentication & authorization
- ✅ Payment processing with escrow
- ✅ Exchange rate integration (Binance, Coinbase)
- ✅ Merchant registration & QR codes
- ✅ Transaction tracking
- ✅ Balance management

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL + Prisma ORM
- **Blockchain:** ethers.js, @solana/web3.js, bitcoinjs-lib
- **Security:** bcrypt, JWT, AES-256 encryption

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Wallets
- `GET /api/wallets` - List user wallets
- `POST /api/wallets` - Create new wallet
- `GET /api/wallets/:id` - Get wallet details
- `GET /api/wallets/:id/balance` - Get wallet balance
- `POST /api/wallets/:id/refresh-balance` - Refresh balance from blockchain
- `POST /api/wallets/:id/send` - Send crypto transaction

### Payments
- `POST /api/payments` - Create payment
- `GET /api/payments` - List payments
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/:id/process` - Process payment
- `POST /api/payments/:id/refund` - Refund payment

### Merchants
- `POST /api/merchants` - Register as merchant
- `GET /api/merchants` - Get merchant account
- `GET /api/merchants/:id` - Get merchant details
- `GET /api/merchants/qr/:qrCode` - Get merchant by QR code
- `PUT /api/merchants/:id` - Update merchant
- `GET /api/merchants/:id/payments` - Get merchant payments

### Exchange
- `GET /api/exchange/rates` - Get exchange rate
- `POST /api/exchange/convert` - Convert amount
- `GET /api/exchange/currencies` - Get supported currencies

## Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Prisma Studio (database GUI)
npm run prisma:studio
```

## Security

- Private keys are encrypted with AES-256-GCM
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens for authentication
- Rate limiting on all endpoints
- Input validation with Zod

## License

Proprietary - TaskForce

