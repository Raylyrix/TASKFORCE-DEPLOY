import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createWallet, getUserWallets, getWalletBalance } from '../services/walletService';
import { updateWalletBalance, sendEthereumTransaction, sendSolanaTransaction } from '../services/blockchainService';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export const walletsRouter = Router();

// All routes require authentication
walletsRouter.use(authenticate);

const createWalletSchema = z.object({
  chain: z.enum(['ethereum', 'solana', 'bitcoin']),
  mnemonic: z.string().optional(), // Optional - will generate if not provided
});

const sendTransactionSchema = z.object({
  to: z.string(),
  amount: z.string(),
  chain: z.string().optional().default('ethereum'),
});

/**
 * GET /api/wallets
 * List user's wallets
 */
walletsRouter.get('/', async (req, res, next) => {
  try {
    const wallets = await getUserWallets(req.userId!);
    
    res.json({
      success: true,
      data: wallets,
    });
  } catch (error) {
    logger.error('Failed to get wallets', { error, userId: req.userId });
    next(error);
  }
});

/**
 * POST /api/wallets
 * Create a new wallet
 */
walletsRouter.post('/', async (req, res, next) => {
  try {
    const body = createWalletSchema.parse(req.body);
    
    const wallet = await createWallet(req.userId!, body.chain, body.mnemonic);
    
    res.status(201).json({
      success: true,
      data: wallet,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Failed to create wallet', { error, userId: req.userId });
    next(error);
  }
});

/**
 * GET /api/wallets/:id
 * Get wallet details
 */
walletsRouter.get('/:id', async (req, res, next) => {
  try {
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
      include: {
        balances: true,
        _count: {
          select: { transactions: true },
        },
      },
    });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }
    
    res.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    logger.error('Failed to get wallet', { error, walletId: req.params.id });
    next(error);
  }
});

/**
 * GET /api/wallets/:id/balance
 * Get wallet balance
 */
walletsRouter.get('/:id/balance', async (req, res, next) => {
  try {
    const balances = await getWalletBalance(req.params.id, req.userId!);
    
    res.json({
      success: true,
      data: balances,
    });
  } catch (error: any) {
    if (error.message === 'Wallet not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    
    logger.error('Failed to get balance', { error, walletId: req.params.id });
    next(error);
  }
});

/**
 * POST /api/wallets/:id/refresh-balance
 * Refresh balance from blockchain
 */
walletsRouter.post('/:id/refresh-balance', async (req, res, next) => {
  try {
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }
    
    const balance = await updateWalletBalance(wallet.id, wallet.chain, wallet.address);
    
    res.json({
      success: true,
      data: { balance },
    });
  } catch (error) {
    logger.error('Failed to refresh balance', { error, walletId: req.params.id });
    next(error);
  }
});

/**
 * POST /api/wallets/:id/send
 * Send crypto transaction
 */
walletsRouter.post('/:id/send', async (req, res, next) => {
  try {
    const body = sendTransactionSchema.parse(req.body);
    const walletId = req.params.id;
    
    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId: req.userId!,
      },
    });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }
    
    // Check balance
    const balance = await getWalletBalance(walletId, req.userId!);
    const nativeBalance = balance.find((b: any) => b.tokenAddress === null);
    
    if (!nativeBalance || BigInt(nativeBalance.balance) < BigInt(body.amount)) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
      });
    }
    
    // Send transaction based on chain
    let txResult: { txHash: string; gasUsed?: string; fee?: string };
    
    switch (wallet.chain) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
        txResult = await sendEthereumTransaction(walletId, req.userId!, body.to, body.amount, wallet.chain);
        break;
      case 'solana':
        txResult = await sendSolanaTransaction(walletId, req.userId!, body.to, body.amount);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Sending not supported for chain: ${wallet.chain}`,
        });
    }
    
    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        walletId,
        chain: wallet.chain,
        fromAddress: wallet.address,
        toAddress: body.to,
        amount: body.amount,
        tokenAddress: null,
        tokenSymbol: wallet.chain === 'ethereum' ? 'ETH' : wallet.chain === 'solana' ? 'SOL' : 'BTC',
        status: 'PENDING',
        txHash: txResult.txHash,
        gasUsed: txResult.gasUsed ? BigInt(txResult.gasUsed) : null,
        fee: txResult.fee || txResult.gasUsed || null,
      },
    });
    
    // Update balance
    await updateWalletBalance(walletId, wallet.chain, wallet.address);
    
    res.json({
      success: true,
      data: {
        transaction,
        txHash: txResult.txHash,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Failed to send transaction', { error, walletId: req.params.id });
    next(error);
  }
});

