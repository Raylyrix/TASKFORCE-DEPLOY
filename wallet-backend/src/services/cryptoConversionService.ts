import { logger } from '../lib/logger';
import { convertAmount } from './exchangeService';
import { prisma } from '../lib/prisma';
import { sendEthereumTransaction, sendSolanaTransaction } from './blockchainService';
import { getWalletPrivateKey } from './walletService';

/**
 * Convert any crypto to a stablecoin (USDT/USDC) for payment
 * This allows users to pay with memecoins or any crypto
 * 
 * Flow:
 * 1. User has DOGE, wants to pay ₹1000
 * 2. Convert DOGE → USDT (in user's wallet)
 * 3. Pay with USDT
 */
export async function convertCryptoToStablecoin(
  userId: string,
  fromWalletId: string,
  fromCrypto: string,
  fromAmount: string,
  toStablecoin: 'USDT' | 'USDC' = 'USDT'
): Promise<{
  stablecoinAmount: string;
  conversionRate: number;
  transactionHash?: string;
}> {
  try {
    // Step 1: Get exchange rate
    const conversion = await convertAmount(
      fromAmount,
      fromCrypto,
      toStablecoin
    );
    
    // Step 2: Get user's stablecoin wallet (or create if doesn't exist)
    let stablecoinWallet = await prisma.wallet.findFirst({
      where: {
        userId,
        chain: toStablecoin === 'USDC' ? 'solana' : 'ethereum', // USDC on Solana, USDT on Ethereum
      },
    });
    
    // If no stablecoin wallet, we need to create one or use exchange
    // For now, we'll use exchange to convert directly
    // In production, you might want to:
    // 1. Create stablecoin wallet for user
    // 2. Transfer crypto to exchange
    // 3. Exchange converts and sends stablecoin to user's wallet
    // 4. Then use stablecoin for payment
    
    logger.info('Crypto conversion initiated', {
      userId,
      fromCrypto,
      fromAmount,
      toStablecoin,
      stablecoinAmount: conversion.amount,
      rate: conversion.rate,
    });
    
    // Step 3: In production, this would:
    // - Transfer crypto to exchange
    // - Exchange converts to stablecoin
    // - Stablecoin sent to user's wallet
    // - Return stablecoin amount
    
    // For now, return the converted amount
    // The actual conversion would happen on the exchange
    return {
      stablecoinAmount: conversion.amount,
      conversionRate: conversion.rate,
    };
  } catch (error: any) {
    logger.error('Crypto conversion failed', { error, userId, fromCrypto, toStablecoin });
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

/**
 * Check if crypto is supported for direct payments
 */
export function isPaymentSupported(cryptoCurrency: string): boolean {
  const cryptoUpper = cryptoCurrency.toUpperCase();
  const SUPPORTED = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'];
  return SUPPORTED.includes(cryptoUpper);
}

/**
 * Get payment options for a user's wallet
 */
export async function getPaymentOptions(userId: string): Promise<{
  directPayment: Array<{ crypto: string; balance: string; chain: string }>;
  requiresConversion: Array<{ crypto: string; balance: string; chain: string }>;
}> {
  const wallets = await prisma.wallet.findMany({
    where: { userId, isActive: true },
    include: {
      balances: {
        where: { tokenAddress: null }, // Native tokens only
        orderBy: { lastUpdated: 'desc' },
        take: 1,
      },
    },
  });
  
  const directPayment: Array<{ crypto: string; balance: string; chain: string }> = [];
  const requiresConversion: Array<{ crypto: string; balance: string; chain: string }> = [];
  
  for (const wallet of wallets) {
    const balance = wallet.balances[0]?.balance || '0';
    const crypto = 
      wallet.chain === 'bitcoin' ? 'BTC' :
      wallet.chain === 'solana' ? 'SOL' : 'ETH';
    
    if (isPaymentSupported(crypto)) {
      directPayment.push({ crypto, balance, chain: wallet.chain });
    } else {
      requiresConversion.push({ crypto, balance, chain: wallet.chain });
    }
  }
  
  return { directPayment, requiresConversion };
}

