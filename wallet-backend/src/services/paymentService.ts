import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { convertAmount } from './exchangeService';
import { sendEthereumTransaction, sendSolanaTransaction } from './blockchainService';
import { getWalletPrivateKey } from './walletService';
import { encrypt } from '../lib/encryption';
import crypto from 'crypto';

const paymentSchema = z.object({
  merchantId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string(), // INR, USD, etc.
  cryptoCurrency: z.string(), // BTC, ETH, SOL, etc.
  walletId: z.string(),
});

/**
 * Create a payment
 */
export async function createPayment(
  userId: string,
  data: z.infer<typeof paymentSchema>
) {
  const validated = paymentSchema.parse(data);
  
  // Get user's wallet
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: validated.walletId,
      userId,
    },
  });
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  // Store walletId in payment for later use
  const walletId = wallet.id;
  
  // Get exchange rate
  const conversion = await convertAmount(
    validated.amount.toString(),
    validated.currency,
    validated.cryptoCurrency
  );
  
  // Check balance
  const balance = await prisma.balance.findFirst({
    where: {
      walletId: wallet.id,
      tokenSymbol: validated.cryptoCurrency,
      tokenAddress: null, // Native token
    },
  });
  
  if (!balance || BigInt(balance.balance) < BigInt(conversion.amount)) {
    throw new Error('Insufficient balance');
  }
  
  // Get or create escrow wallet
  const escrowWallet = await getOrCreateEscrowWallet(wallet.chain);
  
  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId,
      merchantId: validated.merchantId,
      walletId: validated.walletId,
      paymentType: 'QR_PAYMENT',
      amount: validated.amount,
      currency: validated.currency,
      cryptoAmount: conversion.amount,
      cryptoCurrency: validated.cryptoCurrency,
      exchangeRate: conversion.rate,
      status: 'PENDING',
      escrowAddress: escrowWallet.address,
    },
  });
  
  logger.info('Payment created', { paymentId: payment.id, userId, amount: validated.amount });
  
  return payment;
}

/**
 * Process payment (send crypto to escrow)
 */
export async function processPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      userId,
      status: 'PENDING',
    },
  });
  
  if (!payment) {
    throw new Error('Payment not found or already processed');
  }
  
  // Get wallet from payment
  if (!payment.walletId) {
    throw new Error('Payment wallet not found');
  }
  
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: payment.walletId,
      userId,
    },
  });
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  // Send crypto to escrow
  let txResult: { txHash: string; gasUsed?: string; fee?: string };
  
  try {
    switch (wallet.chain) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
        txResult = await sendEthereumTransaction(
          wallet.id,
          userId,
          payment.escrowAddress!,
          payment.cryptoAmount,
          wallet.chain
        );
        break;
      case 'solana':
        txResult = await sendSolanaTransaction(
          wallet.id,
          userId,
          payment.escrowAddress!,
          payment.cryptoAmount
        );
        break;
      default:
        throw new Error(`Unsupported chain: ${wallet.chain}`);
    }
    
    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'PROCESSING',
        escrowTxHash: txResult.txHash,
      },
    });
    
    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        chain: wallet.chain,
        fromAddress: wallet.address,
        toAddress: payment.escrowAddress!,
        amount: payment.cryptoAmount,
        tokenAddress: null,
        tokenSymbol: payment.cryptoCurrency,
        status: 'PENDING',
        txHash: txResult.txHash,
        gasUsed: txResult.gasUsed ? BigInt(txResult.gasUsed) : null,
        fee: txResult.fee || txResult.gasUsed || null,
        payment: {
          connect: { id: paymentId },
        },
      },
    });
    
    logger.info('Payment sent to escrow', { paymentId, txHash: txResult.txHash });
    
    // Queue for settlement (convert to fiat and send to merchant)
    // This would be handled by a background job in production
    
    return {
      paymentId,
      txHash: txResult.txHash,
      status: 'PROCESSING',
    };
  } catch (error) {
    // Update payment as failed
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    throw error;
  }
}

/**
 * Get or create escrow wallet for a chain
 */
async function getOrCreateEscrowWallet(chain: string) {
  let escrow = await prisma.escrowWallet.findFirst({
    where: { chain },
  });
  
  if (!escrow) {
    // Generate new wallet for escrow
    // In production, this should be done securely with proper key management
    const privateKey = crypto.randomBytes(32).toString('hex');
    const privateKeyEnc = encrypt(privateKey);
    
    // Derive address based on chain
    let address: string;
    
    if (chain === 'ethereum' || chain === 'polygon' || chain === 'arbitrum') {
      const { ethers } = await import('ethers');
      const wallet = new ethers.Wallet(privateKey);
      address = wallet.address;
    } else if (chain === 'solana') {
      const { Keypair } = await import('@solana/web3.js');
      const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
      address = keypair.publicKey.toBase58();
    } else {
      throw new Error(`Unsupported chain for escrow: ${chain}`);
    }
    
    escrow = await prisma.escrowWallet.create({
      data: {
        chain,
        address,
        privateKeyEnc,
        balance: '0',
      },
    });
  }
  
  return escrow;
}

/**
 * Complete payment (convert to fiat and settle to merchant)
 * This now uses the settlement service to:
 * 1. Sell crypto for fiat
 * 2. Send fiat to merchant's UPI/bank account
 */
export async function completePayment(paymentId: string) {
  // Import settlement service
  const { settlePayment } = await import('./settlementService');
  
  // Use settlement service to complete payment
  const result = await settlePayment(paymentId);
  
  logger.info('Payment completed via settlement', { paymentId, result });
  
  return result;
}

/**
 * Refund payment
 */
export async function refundPayment(paymentId: string, reason: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
    },
  });
  
  if (!payment) {
    throw new Error('Payment not found');
  }
  
  // Update payment status
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'REFUNDED',
      refundReason: reason,
      refundedAt: new Date(),
    },
  });
  
  // In production, would send crypto back to user's wallet
  // This requires escrow wallet to send back the crypto
  
  logger.info('Payment refunded', { paymentId, reason });
  
  return payment;
}

