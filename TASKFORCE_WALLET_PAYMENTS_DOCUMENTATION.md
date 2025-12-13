# TaskForce Wallet & Payments System - Complete Documentation

**Version:** 1.0.0  
**Date:** December 13, 2025  
**Status:** Planning & Development

---

## 🎯 Project Overview

### Vision
Build a universal crypto wallet with built-in payment system that allows users to:
- Store all cryptocurrencies in one wallet
- Pay merchants in local currency using crypto
- Receive payments instantly
- Manage finances in one app

### Mission
Make crypto payments as easy as UPI, accessible to everyone, globally.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Features](#core-features)
3. [Technical Stack](#technical-stack)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Security Architecture](#security-architecture)
7. [Payment Flow](#payment-flow)
8. [Wallet Architecture](#wallet-architecture)
9. [Exchange Integration](#exchange-integration)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Plan](#deployment-plan)

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Devices                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   iOS App    │  │ Android App  │  │   Web App    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTPS/WSS
                        │
┌─────────────────────────────────────────────────────────┐
│              TaskForce Backend Services                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Wallet API   │  │ Payment API  │  │ Exchange API │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Merchant API │  │ Notification │  │ Analytics    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  PostgreSQL  │ │    Redis    │ │   RabbitMQ  │
│   Database   │ │    Cache    │ │    Queue    │
└──────────────┘ └─────────────┘ └─────────────┘
        │
        │
┌───────▼──────────────────────────────────────┐
│         Blockchain Networks                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Ethereum │ │  Solana  │ │  Bitcoin │     │
│  └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────┘
        │
        │
┌───────▼──────────────────────────────────────┐
│         Exchange APIs                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Binance  │ │ Coinbase │ │ Kraken   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────┘
```

### Component Breakdown

1. **Mobile Apps (iOS/Android)**
   - React Native application
   - Wallet management UI
   - Payment processing UI
   - QR code scanner/generator

2. **Backend Services**
   - Wallet Service: Key management, transaction signing
   - Payment Service: Payment processing, escrow
   - Exchange Service: Crypto-to-fiat conversion
   - Merchant Service: Merchant onboarding, QR generation
   - Notification Service: Push notifications, emails

3. **Database**
   - PostgreSQL: User data, transactions, merchants
   - Redis: Caching, session management
   - RabbitMQ: Async job processing

4. **Blockchain Integration**
   - Ethereum (via ethers.js)
   - Solana (via @solana/web3.js)
   - Bitcoin (via bitcoinjs-lib)

5. **Exchange Integration**
   - Binance API
   - Coinbase API
   - Kraken API (fallback)

---

## 🎨 Core Features

### Wallet Features

1. **Multi-Chain Support**
   - Ethereum & EVM chains (Polygon, Arbitrum, BSC, etc.)
   - Solana
   - Bitcoin
   - Support for all major tokens

2. **Security**
   - Encrypted private key storage
   - Biometric authentication
   - Hardware wallet support (Ledger, Trezor)
   - Multi-signature support
   - Recovery phrase (12/24 words)

3. **Transaction Management**
   - Send/receive crypto
   - Transaction history
   - Pending transactions
   - Transaction details

4. **Balance Management**
   - Multi-chain balance view
   - Token balances
   - Portfolio value (USD equivalent)
   - Price tracking

### Payment Features

1. **QR Code Payments**
   - Scan merchant QR code
   - Enter amount
   - Confirm payment
   - Instant settlement

2. **Payment Methods**
   - Pay with any crypto
   - Auto-convert to merchant's currency
   - Price lock (30 seconds)
   - Multiple payment options

3. **Merchant Features**
   - Generate QR codes
   - Receive payments in local currency
   - Settlement to bank account
   - Payment notifications
   - Analytics dashboard

4. **Payment Management**
   - Payment history
   - Pending payments
   - Failed payments
   - Refund handling

---

## 💻 Technical Stack

### Frontend

**Mobile App:**
- React Native (iOS + Android)
- TypeScript
- React Navigation
- React Query (data fetching)
- Zustand (state management)

**Libraries:**
- `ethers.js` - Ethereum integration
- `@solana/web3.js` - Solana integration
- `bitcoinjs-lib` - Bitcoin integration
- `react-native-keychain` - Secure storage
- `react-native-encrypted-storage` - Encrypted storage
- `react-native-qrcode-scanner` - QR scanning
- `react-native-qrcode-generator` - QR generation

### Backend

**Core:**
- Node.js + TypeScript
- Express.js (REST API)
- PostgreSQL (database)
- Redis (caching)
- RabbitMQ (job queue)

**Blockchain:**
- `ethers.js` - Ethereum
- `@solana/web3.js` - Solana
- `bitcoinjs-lib` - Bitcoin
- Web3 providers (Alchemy, Infura, QuickNode)

**Exchange:**
- Binance API SDK
- Coinbase API SDK
- Axios for HTTP requests

**Security:**
- bcrypt (password hashing)
- jsonwebtoken (JWT tokens)
- crypto (encryption)

**Other:**
- Prisma (ORM)
- Bull (job queue)
- Socket.io (real-time updates)

---

## 🗄️ Database Schema

### Core Tables

#### Users
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  phone         String?  @unique
  passwordHash  String
  displayName   String?
  avatar        String?
  kycStatus     String   @default("PENDING") // PENDING, VERIFIED, REJECTED
  kycData       Json?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  wallets       Wallet[]
  payments      Payment[]
  merchants     Merchant[]
  transactions  Transaction[]
  addresses     Address[]
}
```

#### Wallets
```prisma
model Wallet {
  id            String   @id @default(cuid())
  userId        String
  chain         String   // ethereum, solana, bitcoin
  address       String   @unique
  privateKeyEnc String  // Encrypted private key
  derivationPath String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id])
  addresses     Address[]
  transactions  Transaction[]
  balances      Balance[]
}
```

#### Addresses (Derived addresses for different chains)
```prisma
model Address {
  id            String   @id @default(cuid())
  walletId      String
  userId        String
  chain         String
  address       String
  label         String?  // Custom label
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())

  wallet        Wallet   @relation(fields: [walletId], references: [id])
  user          User    @relation(fields: [userId], references: [id])
  transactions  Transaction[]
}
```

#### Balances
```prisma
model Balance {
  id            String   @id @default(cuid())
  walletId      String
  chain         String
  tokenAddress  String?  // null for native tokens
  tokenSymbol   String
  balance       String   // BigInt as string
  usdValue      Decimal?
  lastUpdated   DateTime @default(now())
  updatedAt     DateTime @updatedAt

  wallet        Wallet   @relation(fields: [walletId], references: [id])

  @@unique([walletId, chain, tokenAddress])
  @@index([walletId])
}
```

#### Transactions
```prisma
model Transaction {
  id            String   @id @default(cuid())
  userId        String
  walletId      String
  addressId     String?
  chain         String
  txHash        String?  @unique
  fromAddress   String
  toAddress     String
  amount        String   // BigInt as string
  tokenAddress  String?  // null for native tokens
  tokenSymbol   String
  status        String   // PENDING, CONFIRMED, FAILED
  blockNumber   BigInt?
  gasUsed       BigInt?
  gasPrice      BigInt?
  fee           String?
  error         String?
  createdAt     DateTime @default(now())
  confirmedAt   DateTime?

  user          User     @relation(fields: [userId], references: [id])
  wallet        Wallet   @relation(fields: [walletId], references: [id])
  address       Address? @relation(fields: [addressId], references: [id])
  payment       Payment?

  @@index([userId])
  @@index([txHash])
  @@index([status])
  @@index([chain])
}
```

#### Payments
```prisma
model Payment {
  id              String   @id @default(cuid())
  userId          String
  merchantId      String?
  transactionId   String?  @unique
  paymentType     String   // QR_PAYMENT, REQUEST, SPLIT
  amount          Decimal
  currency        String   // INR, USD, etc.
  cryptoAmount    String   // Amount in crypto
  cryptoCurrency  String   // BTC, ETH, etc.
  exchangeRate    Decimal
  status          String   // PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
  escrowAddress   String?  // Escrow wallet address
  merchantBankAccount String?
  settlementTxId  String?
  error           String?
  refundReason    String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  refundedAt      DateTime?

  user            User     @relation(fields: [userId], references: [id])
  merchant        Merchant? @relation(fields: [merchantId], references: [id])
  transaction     Transaction?

  @@index([userId])
  @@index([merchantId])
  @@index([status])
  @@index([createdAt])
}
```

#### Merchants
```prisma
model Merchant {
  id              String   @id @default(cuid())
  userId          String
  businessName    String
  businessType    String?
  phone           String?
  email           String?
  address         String?
  bankAccount     String?
  bankName        String?
  ifscCode        String?
  qrCode          String   @unique
  isActive        Boolean  @default(true)
  settlementDelay Int      @default(0) // Minutes
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id])
  payments        Payment[]

  @@index([userId])
  @@index([qrCode])
}
```

#### Exchange Rates
```prisma
model ExchangeRate {
  id            String   @id @default(cuid())
  fromCurrency  String   // BTC, ETH, etc.
  toCurrency    String   // INR, USD, etc.
  rate          Decimal
  source        String   // binance, coinbase, etc.
  timestamp     DateTime @default(now())

  @@index([fromCurrency, toCurrency])
  @@index([timestamp])
}
```

#### Escrow Wallets
```prisma
model EscrowWallet {
  id            String   @id @default(cuid())
  chain         String
  address       String   @unique
  privateKeyEnc String  // Encrypted
  balance       String   // Current balance
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([chain])
}
```

---

## 🔌 API Design

### Authentication Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Wallet Endpoints

```
GET    /api/wallets                    # List user wallets
POST   /api/wallets                    # Create new wallet
GET    /api/wallets/:id                # Get wallet details
GET    /api/wallets/:id/balance       # Get wallet balance
GET    /api/wallets/:id/transactions  # Get transaction history
POST   /api/wallets/:id/send          # Send crypto
POST   /api/wallets/:id/receive       # Generate receive address
```

### Payment Endpoints

```
POST   /api/payments/qr/scan          # Scan QR and create payment
POST   /api/payments                   # Create payment
GET    /api/payments                   # List payments
GET    /api/payments/:id              # Get payment details
POST   /api/payments/:id/confirm      # Confirm payment
POST   /api/payments/:id/cancel       # Cancel payment
POST   /api/payments/:id/refund       # Request refund
```

### Merchant Endpoints

```
POST   /api/merchants                  # Register as merchant
GET    /api/merchants                  # List merchants
GET    /api/merchants/:id             # Get merchant details
GET    /api/merchants/:id/qr          # Get merchant QR code
POST   /api/merchants/:id/settlement  # Update settlement details
GET    /api/merchants/:id/payments    # Get merchant payments
```

### Exchange Endpoints

```
GET    /api/exchange/rates             # Get exchange rates
GET    /api/exchange/rate/:from/:to   # Get specific rate
POST   /api/exchange/convert          # Convert amount
```

### Address Endpoints

```
GET    /api/addresses                  # List addresses
POST   /api/addresses                 # Create address
GET    /api/addresses/:id             # Get address details
PUT    /api/addresses/:id             # Update address
DELETE /api/addresses/:id             # Delete address
```

---

## 🔒 Security Architecture

### Key Management

1. **Master Seed Generation**
   - Generate 12/24 word mnemonic
   - Use BIP39 standard
   - Store encrypted on device
   - Never sent to server

2. **Private Key Derivation**
   - Use BIP44 derivation paths
   - Derive keys locally
   - Encrypt with device key
   - Store encrypted in secure storage

3. **Transaction Signing**
   - Sign locally on device
   - Never send private keys to server
   - Use hardware wallet when available
   - Show transaction details before signing

### Authentication

1. **User Authentication**
   - Email/phone + password
   - 2FA support
   - Biometric authentication
   - Session management

2. **API Security**
   - JWT tokens
   - Rate limiting
   - IP whitelisting (optional)
   - Request signing

### Data Protection

1. **Encryption**
   - Private keys: AES-256
   - Database: Encrypted at rest
   - Network: TLS 1.3
   - Backups: Encrypted

2. **Access Control**
   - Role-based access
   - Permission system
   - Audit logging
   - Suspicious activity detection

---

## 💳 Payment Flow

### Standard Payment Flow

```
1. User scans QR code
   ↓
2. App extracts merchant ID + amount
   ↓
3. User selects crypto to pay with
   ↓
4. App fetches exchange rate
   ↓
5. App calculates crypto amount needed
   ↓
6. User confirms payment
   ↓
7. App checks user balance
   ↓
8. App sends crypto to escrow wallet
   ↓
9. Backend receives crypto
   ↓
10. Backend converts to fiat (exchange)
   ↓
11. Backend sends fiat to merchant bank
   ↓
12. Payment complete
   ↓
13. Notify user and merchant
```

### Failure Handling

```
If balance insufficient:
  → Show error, offer to buy crypto

If network congested:
  → Retry with higher gas
  → Show status, allow cancellation

If exchange fails:
  → Retry with different exchange
  → Queue for later processing
  → Refund if can't complete

If price slippage >5%:
  → Cancel payment
  → Refund to user
  → Notify user

If merchant account invalid:
  → Hold in escrow
  → Notify merchant
  → Refund after 7 days
```

---

## 🎯 Wallet Architecture

### Multi-Chain Support

1. **Ethereum Chains**
   - Use ethers.js
   - Support all EVM chains
   - Dynamic RPC switching
   - Gas estimation

2. **Solana**
   - Use @solana/web3.js
   - Support SPL tokens
   - Transaction building
   - Fee calculation

3. **Bitcoin**
   - Use bitcoinjs-lib
   - Support SegWit
   - Fee estimation
   - UTXO management

### Balance Management

1. **Real-time Updates**
   - WebSocket connections
   - Block polling
   - Transaction monitoring
   - Cache with Redis

2. **Portfolio View**
   - Aggregate all chains
   - USD conversion
   - Price tracking
   - Historical data

---

## 🔄 Exchange Integration

### Supported Exchanges

1. **Binance**
   - Spot trading
   - Real-time rates
   - Order execution
   - API key management

2. **Coinbase**
   - Spot trading
   - Real-time rates
   - Order execution
   - OAuth integration

3. **Kraken (Fallback)**
   - Spot trading
   - Real-time rates
   - Order execution

### Rate Management

1. **Real-time Rates**
   - Fetch every 5 seconds
   - Cache for 30 seconds
   - Multiple source fallback
   - Price protection

2. **Order Execution**
   - Market orders
   - Slippage protection
   - Order tracking
   - Retry logic

---

## 📅 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Project setup
- [ ] Database schema
- [ ] Authentication system
- [ ] Basic wallet (Ethereum only)
- [ ] Key management
- [ ] Balance queries

### Phase 2: Core Wallet (Weeks 5-8)
- [ ] Send/receive transactions
- [ ] Transaction history
- [ ] Multi-chain support (Solana, Bitcoin)
- [ ] Address management
- [ ] Portfolio view

### Phase 3: Payment System (Weeks 9-12)
- [ ] QR code generation
- [ ] QR code scanning
- [ ] Payment processing
- [ ] Escrow system
- [ ] Exchange integration
- [ ] Bank settlement

### Phase 4: Merchant Features (Weeks 13-16)
- [ ] Merchant registration
- [ ] Merchant dashboard
- [ ] Payment analytics
- [ ] Settlement management
- [ ] Notification system

### Phase 5: Advanced Features (Weeks 17-20)
- [ ] Failure handling
- [ ] Refund system
- [ ] Multi-currency support
- [ ] Advanced analytics
- [ ] Security hardening

### Phase 6: Testing & Launch (Weeks 21-24)
- [ ] Comprehensive testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Beta testing
- [ ] Production launch

---

## 🧪 Testing Strategy

### Unit Tests
- Wallet operations
- Transaction signing
- Exchange rate calculations
- Payment processing logic

### Integration Tests
- Blockchain interactions
- Exchange API calls
- Database operations
- Payment flows

### E2E Tests
- Complete payment flow
- Multi-chain operations
- Failure scenarios
- User journeys

### Security Tests
- Key management
- Encryption
- Authentication
- Authorization

---

## 🚀 Deployment Plan

### Infrastructure
- Backend: Railway/Render/AWS
- Database: Managed PostgreSQL
- Cache: Redis Cloud
- Queue: RabbitMQ Cloud
- Monitoring: Sentry, LogRocket

### Mobile Apps
- iOS: App Store
- Android: Google Play Store
- Beta: TestFlight, Google Play Beta

### Security
- SSL certificates
- DDoS protection
- Rate limiting
- Monitoring & alerts

---

## 📊 Success Metrics

### User Metrics
- Active users
- Wallet creation rate
- Payment volume
- Transaction success rate

### Business Metrics
- Revenue (fees)
- Merchant adoption
- Payment volume
- User retention

### Technical Metrics
- API response time
- Transaction confirmation time
- Uptime
- Error rate

---

## 🎯 Next Steps

1. Set up project structure
2. Initialize database
3. Build authentication
4. Implement basic wallet
5. Add payment system
6. Integrate exchanges
7. Build mobile apps
8. Test & deploy

---

**Document Version:** 1.0.0  
**Last Updated:** December 13, 2025  
**Status:** Ready for Development

