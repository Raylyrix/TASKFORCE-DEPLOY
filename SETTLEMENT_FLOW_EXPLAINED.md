# 💰 Settlement Flow - How Crypto Becomes INR in Merchant's UPI

## 🎯 The Complete Flow (Step by Step)

### Current Situation:

```
User has: 0.01 ETH (worth ₹25,000)
User wants to pay: ₹1000 to merchant
Merchant has: PhonePe UPI ID: merchant@ybl
```

## 📊 Step-by-Step Settlement Process

### Step 1: User Initiates Payment

```
User scans QR → Enters ₹1000 → Selects ETH wallet
System calculates: ₹1000 = 0.004 ETH (at current rate)
```

### Step 2: Crypto Locked in Escrow

```
User's Wallet: 0.01 ETH → 0.006 ETH (0.004 sent to escrow)
Escrow Wallet: 0.004 ETH (locked)
Status: PROCESSING
```

**At this point:**

- ✅ User's crypto is locked
- ✅ Merchant knows payment is coming
- ⚠️ But merchant doesn't have ₹1000 yet!

### Step 3: Settlement (THE MISSING PIECE)

#### Option A: Using Exchange + Payment Gateway (Recommended)

**3a. Sell Crypto for INR:**

```
Escrow: 0.004 ETH
    ↓
Exchange API (Binance/Coinbase)
    ↓
Sell 0.004 ETH → Get ₹1000 (minus exchange fee)
    ↓
TaskForce Account: ₹1000
```

**3b. Send INR to Merchant's UPI:**

```
TaskForce Account: ₹1000
    ↓
Payment Gateway API (Razorpay/PhonePe)
    ↓
Send ₹1000 to merchant@ybl
    ↓
Merchant receives: ₹1000 in PhonePe
```

#### Option B: Using Exchange with Direct Bank Transfer

**3a. Sell Crypto:**

```
Escrow: 0.004 ETH → Exchange → ₹1000
```

**3b. Bank Transfer:**

```
TaskForce Bank Account: ₹1000
    ↓
Bank API (RazorpayX/Stripe)
    ↓
IMPS/NEFT to Merchant Bank Account
    ↓
Merchant receives: ₹1000 in bank
```

## 🔧 What We Need to Implement

### 1. Exchange Integration (Sell Crypto)

```typescript
// New service: settlementService.ts

async function sellCryptoForFiat(
  cryptoAmount: string,
  cryptoCurrency: string,
  fiatCurrency: string
): Promise<number> {
  // 1. Connect to exchange (Binance/Coinbase)
  // 2. Create sell order: 0.004 ETH → INR
  // 3. Execute trade
  // 4. Get fiat amount: ₹1000
  // 5. Return fiat amount
}
```

**Example with Binance API:**

```typescript
// Sell ETH for INR
const order = await binance.order({
  symbol: "ETHINR",
  side: "SELL",
  type: "MARKET",
  quantity: "0.004",
});

// Get executed price
const fiatAmount = order.executedQty * order.price; // ₹1000
```

### 2. UPI Payment Integration

```typescript
// Using Razorpay API

async function sendToUPI(amount: number, upiId: string): Promise<string> {
  // 1. Create payout via Razorpay
  const payout = await razorpay.payouts.create({
    account_number: "our_bank_account",
    fund_account: {
      account_type: "vpa", // Virtual Payment Address (UPI)
      vpa: {
        address: upiId, // merchant@ybl
      },
    },
    amount: amount * 100, // in paise (₹1000 = 100000 paise)
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
  });

  // 2. Return transaction ID
  return payout.id;
}
```

### 3. Complete Settlement Flow

```typescript
// settlementService.ts

export async function settlePayment(paymentId: string) {
  // 1. Get payment from database
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { merchant: true },
  });

  // 2. Get escrow wallet
  const escrow = await getEscrowWallet(payment.cryptoCurrency);

  // 3. Sell crypto for INR
  const fiatAmount = await sellCryptoForFiat(
    payment.cryptoAmount, // 0.004 ETH
    payment.cryptoCurrency, // ETH
    payment.currency // INR
  );

  // 4. Deduct fees
  const merchantAmount = fiatAmount * 0.98; // 2% fee
  const ourFee = fiatAmount * 0.02;

  // 5. Send to merchant UPI
  const payoutId = await sendToUPI(
    merchantAmount, // ₹980
    payment.merchant.upiId // merchant@ybl
  );

  // 6. Update payment status
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "COMPLETED",
      settlementTxId: payoutId,
      completedAt: new Date(),
    },
  });

  return { success: true, payoutId };
}
```

## 🏦 Required Integrations

### 1. Exchange API (Choose One)

**Option A: Binance**

- ✅ Best rates globally
- ✅ Supports INR pairs
- ✅ API available
- ⚠️ Requires KYC for large volumes

**Option B: Coinbase**

- ✅ US-based, compliant
- ✅ Good API
- ⚠️ Limited INR support

**Option C: Indian Exchanges**

- ✅ WazirX (owned by Binance)
- ✅ CoinDCX
- ✅ Direct INR support
- ✅ Better for Indian market

### 2. Payment Gateway (Choose One)

**Option A: Razorpay**

- ✅ UPI payout support
- ✅ Bank transfer support
- ✅ Good API
- ✅ Indian company

**Option B: PhonePe Payment Gateway**

- ✅ Direct UPI integration
- ✅ Merchant API
- ⚠️ Limited documentation

**Option C: Stripe (India)**

- ✅ International
- ✅ UPI support
- ⚠️ Higher fees

## 💡 Complete Example Flow

### Scenario: User pays ₹1000 to merchant

```
1. User creates payment:
   - Amount: ₹1000
   - Crypto: 0.004 ETH
   - Merchant: merchant@ybl

2. Crypto locked in escrow:
   - Escrow has: 0.004 ETH
   - Status: PROCESSING

3. Settlement (automatic):
   a. Sell crypto:
      - Exchange: 0.004 ETH → ₹1000
      - Fee: ₹10 (1%)
      - Net: ₹990

   b. Deduct platform fee:
      - Platform fee: ₹20 (2%)
      - Merchant gets: ₹970

   c. Send to UPI:
      - Razorpay API: Send ₹970 to merchant@ybl
      - Transaction ID: payout_abc123

   d. Update payment:
      - Status: COMPLETED
      - Settlement ID: payout_abc123

4. Merchant receives:
   - PhonePe notification: "₹970 received from TaskForce"
   - Merchant sees payment in PhonePe app
```

## 🔐 Security & Compliance

### Required:

1. **KYC/AML** for exchange account
2. **Payment Gateway Account** (Razorpay/PhonePe)
3. **Bank Account** for holding fiat
4. **Compliance** with RBI regulations (for India)

### Fees Structure:

```
User pays: ₹1000
- Exchange fee: ₹10 (1%)
- Platform fee: ₹20 (2%)
- Merchant receives: ₹970
- Our revenue: ₹20
```

## 🚀 Implementation Priority

### Phase 1: Basic Settlement (Manual)

- ✅ Exchange API integration
- ✅ Manual settlement trigger
- ✅ UPI payout integration

### Phase 2: Automated Settlement

- ✅ Background jobs
- ✅ Automatic processing
- ✅ Error handling & retries

### Phase 3: Advanced Features

- ✅ Batch settlements
- ✅ Fee optimization
- ✅ Multi-currency support

## 📝 Current Status

**What Works:**

- ✅ User can create payment
- ✅ Crypto goes to escrow
- ✅ Payment tracking

**What's Missing:**

- ⚠️ Exchange API integration (sell crypto)
- ⚠️ Payment gateway integration (send to UPI)
- ⚠️ Settlement automation

## 🎯 Next Steps

1. **Choose Exchange Partner**

   - WazirX (recommended for India)
   - Get API credentials

2. **Choose Payment Gateway**

   - Razorpay (recommended)
   - Get merchant account

3. **Implement Settlement Service**
   - Exchange integration
   - UPI payout integration
   - Automation

---

**The system is 90% complete! We just need to add the settlement layer to convert crypto → INR → UPI transfer.**
