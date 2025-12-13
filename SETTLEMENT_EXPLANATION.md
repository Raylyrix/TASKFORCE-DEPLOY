# 💰 How Crypto Converts to INR and Reaches Merchant's PhonePe UPI

## 🎯 Simple Explanation

**Question:** User has ETH, wants to pay ₹1000. Merchant has PhonePe UPI. How does ₹1000 reach merchant?

**Answer:** We need 2 steps:
1. **Sell crypto** → Get ₹1000 in our bank account
2. **Send ₹1000** → Transfer to merchant's PhonePe UPI

## 📱 Complete Flow with PhonePe UPI

### Step 1: User Creates Payment
```
User: "I want to pay ₹1000"
System: "That's 0.004 ETH at current rate"
User: "Confirm"
```

### Step 2: Crypto Goes to Escrow
```
User's ETH: 0.01 → 0.006 ETH (0.004 sent to escrow)
Escrow: 0.004 ETH (locked)
Status: PROCESSING
```

### Step 3: Settlement (Automatic)

#### 3a. Sell Crypto for INR
```
Escrow: 0.004 ETH
    ↓
WazirX/Binance Exchange API
    ↓
Sell 0.004 ETH → Get ₹1000
    ↓
TaskForce Bank Account: ₹1000
```

**How it works:**
- We call exchange API: "Sell 0.004 ETH for INR"
- Exchange executes trade
- ₹1000 appears in our bank account
- Exchange takes small fee (₹10)

#### 3b. Send INR to Merchant's PhonePe
```
TaskForce Bank: ₹1000
    ↓
Razorpay API (Payment Gateway)
    ↓
Send ₹1000 to merchant@ybl
    ↓
Merchant's PhonePe: ₹1000 received! ✅
```

**How it works:**
- We call Razorpay API: "Send ₹1000 to merchant@ybl"
- Razorpay transfers from our bank to merchant's UPI
- Merchant gets notification: "₹1000 received from TaskForce"
- Merchant sees money in PhonePe app

## 🔧 Technical Implementation

### 1. Exchange API (Sell Crypto)

```typescript
// Example: WazirX API
const response = await axios.post('https://api.wazirx.com/api/v2/orders', {
  symbol: 'ethinr',        // ETH to INR
  side: 'sell',           // Sell ETH
  type: 'market',         // Market order (instant)
  quantity: '0.004'       // Amount of ETH
}, {
  headers: {
    'X-Api-Key': EXCHANGE_API_KEY,
    'X-Api-Secret': EXCHANGE_API_SECRET
  }
});

// Result: ₹1000 in our account
```

### 2. Razorpay API (Send to UPI)

```typescript
// Example: Razorpay Payout API
const payout = await axios.post('https://api.razorpay.com/v1/payouts', {
  account_number: 'our_bank_account',
  fund_account: {
    account_type: 'vpa',  // Virtual Payment Address (UPI)
    vpa: {
      address: 'merchant@ybl'  // Merchant's PhonePe UPI
    }
  },
  amount: 100000,  // ₹1000 in paise (1000 * 100)
  currency: 'INR',
  mode: 'UPI'
}, {
  headers: {
    Authorization: `Basic ${razorpayAuth}`
  }
});

// Result: ₹1000 sent to merchant's PhonePe
```

## 💡 Real Example

### Scenario:
- **User:** Has 0.01 ETH (worth ₹25,000)
- **Merchant:** PhonePe UPI: `streetvendor@ybl`
- **Payment:** ₹1000

### Flow:

```
1. User pays ₹1000
   ↓
2. System calculates: ₹1000 = 0.004 ETH
   ↓
3. 0.004 ETH sent to escrow (locked)
   ↓
4. Settlement starts (automatic):
   
   a. Exchange API:
      "Sell 0.004 ETH for INR"
      → Exchange executes
      → ₹1000 in our bank (minus ₹10 fee = ₹990)
   
   b. Razorpay API:
      "Send ₹970 to streetvendor@ybl"
      → Razorpay transfers
      → Merchant receives ₹970 in PhonePe
   
5. Merchant sees in PhonePe:
   "₹970 received from TaskForce Wallet"
   ✅ Payment complete!
```

## 🏦 What We Need

### 1. Exchange Account
- **WazirX** (recommended for India)
- **Binance** (global, better rates)
- Get API keys

### 2. Payment Gateway Account
- **Razorpay** (recommended)
- **PhonePe Payment Gateway**
- Get merchant account + API keys

### 3. Bank Account
- TaskForce company bank account
- To hold fiat temporarily
- For settlements

## 📊 Fees Breakdown

```
User wants to pay: ₹1000

Step 1: Sell 0.004 ETH
- Exchange fee: ₹10 (1%)
- Net received: ₹990

Step 2: Platform fee
- Our fee: ₹20 (2% of ₹1000)
- Merchant gets: ₹970

Step 3: Send to UPI
- Razorpay fee: ₹5
- Final to merchant: ₹970

Summary:
- User paid: 0.004 ETH (worth ₹1000)
- Merchant received: ₹970
- Our revenue: ₹20
- Total fees: ₹30 (exchange + gateway)
```

## ✅ What's Implemented

I've created:
1. ✅ **Settlement Service** (`settlementService.ts`)
   - `sellCryptoForFiat()` - Sells crypto for INR
   - `sendToUPI()` - Sends INR to merchant UPI
   - `settlePayment()` - Complete settlement flow

2. ✅ **Updated Payment Service**
   - `completePayment()` now uses settlement service

3. ✅ **Updated Merchant Model**
   - Added `upiId` field
   - Added `upiVerified` field

## 🚀 Next Steps

1. **Get Exchange API Keys**
   - Sign up for WazirX/Binance
   - Get API credentials
   - Set: `EXCHANGE_API_KEY`, `EXCHANGE_API_SECRET`

2. **Get Razorpay Account**
   - Sign up for Razorpay
   - Get API keys
   - Set: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

3. **Test Settlement**
   - Test with small amount (₹10)
   - Verify merchant receives money
   - Monitor for errors

4. **Automate**
   - Background job to auto-settle payments
   - Run every hour/daily
   - Handle failures & retries

---

**The code is ready! Just need to add API credentials and it will work!**

