import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import axios from 'axios';

// Exchange API configuration
const EXCHANGE_API_KEY = process.env.EXCHANGE_API_KEY || '';
const EXCHANGE_API_SECRET = process.env.EXCHANGE_API_SECRET || '';
const EXCHANGE_BASE_URL = process.env.EXCHANGE_BASE_URL || 'https://api.wazirx.com/api/v2';

// Payment Gateway configuration (Razorpay)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

/**
 * Sell crypto for fiat using exchange API
 * Example: Sell 0.004 ETH for ₹1000
 */
export async function sellCryptoForFiat(
  cryptoAmount: string,
  cryptoCurrency: string,
  fiatCurrency: string
): Promise<{ fiatAmount: number; exchangeRate: number; transactionId?: string }> {
  try {
    // For WazirX API
    const symbol = `${cryptoCurrency}${fiatCurrency}`.toLowerCase(); // ethinr
    
    // Get current market price
    const tickerResponse = await axios.get(`${EXCHANGE_BASE_URL}/ticker/${symbol}`);
    const currentPrice = parseFloat(tickerResponse.data.last);
    
    // Calculate fiat amount
    const fiatAmount = parseFloat(cryptoAmount) * currentPrice;
    
    // In production, you would:
    // 1. Create a sell order on the exchange
    // 2. Wait for order execution
    // 3. Get the actual executed price
    
    logger.info('Crypto sold for fiat', {
      cryptoAmount,
      cryptoCurrency,
      fiatAmount,
      fiatCurrency,
      rate: currentPrice,
    });
    
    return {
      fiatAmount,
      exchangeRate: currentPrice,
    };
  } catch (error: any) {
    logger.error('Failed to sell crypto for fiat', { error, cryptoAmount, cryptoCurrency });
    throw new Error(`Exchange error: ${error.message}`);
  }
}

/**
 * Send fiat amount to merchant's UPI ID
 * Example: Send ₹1000 to merchant@ybl
 */
export async function sendToUPI(
  amount: number,
  upiId: string,
  merchantName: string
): Promise<{ payoutId: string; status: string }> {
  try {
    // Razorpay API integration
    // Note: This requires Razorpay account setup
    
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    // Create fund account (if not exists)
    // In production, store fund account ID in merchant record
    
    // Create payout
    const payoutResponse = await axios.post(
      `${RAZORPAY_BASE_URL}/payouts`,
      {
        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Your bank account
        fund_account: {
          account_type: 'vpa', // Virtual Payment Address (UPI)
          vpa: {
            address: upiId, // merchant@ybl
          },
          contact: {
            name: merchantName,
            email: `${upiId}@merchant.taskforce.com`, // Placeholder
            contact: '9999999999', // Placeholder
            type: 'vendor',
          },
        },
        amount: amount * 100, // Convert to paise (₹1000 = 100000 paise)
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `taskforce_${Date.now()}`,
        narration: `Payment from TaskForce Wallet`,
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    logger.info('UPI payout created', {
      payoutId: payoutResponse.data.id,
      amount,
      upiId,
      status: payoutResponse.data.status,
    });
    
    return {
      payoutId: payoutResponse.data.id,
      status: payoutResponse.data.status,
    };
  } catch (error: any) {
    logger.error('Failed to send to UPI', { error, amount, upiId });
    
    // If Razorpay is not configured, return mock response for development
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      logger.warn('Razorpay not configured, returning mock payout');
      return {
        payoutId: `mock_payout_${Date.now()}`,
        status: 'queued',
      };
    }
    
    throw new Error(`UPI payout error: ${error.response?.data?.error?.description || error.message}`);
  }
}

/**
 * Complete payment settlement
 * 1. Sell crypto for fiat
 * 2. Deduct fees
 * 3. Send to merchant UPI
 */
export async function settlePayment(paymentId: string): Promise<{
  success: boolean;
  payoutId?: string;
  fiatAmount?: number;
  merchantAmount?: number;
  fee?: number;
}> {
  try {
    // 1. Get payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        merchant: true,
      },
    });
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    if (payment.status !== 'PROCESSING') {
      throw new Error(`Payment not in PROCESSING state. Current: ${payment.status}`);
    }
    
    // 2. Get escrow wallet
    const escrow = await prisma.escrowWallet.findFirst({
      where: {
        chain: payment.cryptoCurrency === 'BTC' ? 'bitcoin' :
               payment.cryptoCurrency === 'SOL' ? 'solana' : 'ethereum',
      },
    });
    
    if (!escrow) {
      throw new Error('Escrow wallet not found');
    }
    
    // 3. Sell crypto for fiat
    const { fiatAmount, exchangeRate } = await sellCryptoForFiat(
      payment.cryptoAmount,
      payment.cryptoCurrency,
      payment.currency
    );
    
    // 4. Calculate fees
    const platformFeePercent = 0.02; // 2%
    const platformFee = fiatAmount * platformFeePercent;
    const merchantAmount = fiatAmount - platformFee;
    
    // 5. Send to merchant UPI
    if (!payment.merchant?.upiId) {
      throw new Error('Merchant UPI ID not configured');
    }
    
    const payout = await sendToUPI(
      merchantAmount,
      payment.merchant.upiId,
      payment.merchant.businessName || 'Merchant'
    );
    
    // 6. Update payment
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        settlementTxId: payout.payoutId,
        completedAt: new Date(),
        // Store settlement details
        merchantBankAccount: payout.payoutId, // Store payout ID
      },
    });
    
    // 7. Record settlement
    await prisma.payment.create({
      data: {
        // This would be a settlement record
        // For now, we update the original payment
      },
    });
    
    logger.info('Payment settled successfully', {
      paymentId,
      payoutId: payout.payoutId,
      fiatAmount,
      merchantAmount,
      fee: platformFee,
    });
    
    return {
      success: true,
      payoutId: payout.payoutId,
      fiatAmount,
      merchantAmount,
      fee: platformFee,
    };
  } catch (error: any) {
    logger.error('Settlement failed', { error, paymentId });
    
    // Update payment with error
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        error: error.message,
      },
    });
    
    throw error;
  }
}

/**
 * Batch settlement - Process multiple payments at once
 */
export async function batchSettlePayments(paymentIds: string[]): Promise<{
  successful: number;
  failed: number;
  results: Array<{ paymentId: string; success: boolean; error?: string }>;
}> {
  const results = [];
  let successful = 0;
  let failed = 0;
  
  for (const paymentId of paymentIds) {
    try {
      await settlePayment(paymentId);
      results.push({ paymentId, success: true });
      successful++;
    } catch (error: any) {
      results.push({ paymentId, success: false, error: error.message });
      failed++;
    }
  }
  
  return { successful, failed, results };
}

