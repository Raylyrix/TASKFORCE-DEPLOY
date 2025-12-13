import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createPayment, processPayment, completePayment, refundPayment } from '../services/paymentService';
import { getPaymentOptions } from '../services/cryptoConversionService';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export const paymentsRouter = Router();

// All routes require authentication
paymentsRouter.use(authenticate);

const createPaymentSchema = z.object({
  merchantId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string(),
  cryptoCurrency: z.string(),
  walletId: z.string(),
});

/**
 * GET /api/payments/options
 * Get payment options (which cryptos can be used)
 */
paymentsRouter.get('/options', async (req, res, next) => {
  try {
    const options = await getPaymentOptions(req.userId!);
    
    res.json({
      success: true,
      data: {
        ...options,
        supportedCryptos: ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'],
        message: 'Direct payments supported for BTC, ETH, SOL, USDT, USDC. Other cryptos require conversion to USDT/USDC first.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to get payment options', { error, userId: req.userId });
    next(error);
  }
});

/**
 * POST /api/payments
 * Create a new payment
 */
paymentsRouter.post('/', async (req, res, next) => {
  try {
    const body = createPaymentSchema.parse(req.body);
    
    const payment = await createPayment(req.userId!, body);
    
    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    if (error.message === 'Wallet not found' || error.message === 'Insufficient balance') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    // Handle unsupported crypto error
    if (error.message.includes('not supported for direct payments')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        suggestion: 'Please convert your crypto to USDT or USDC first, or use BTC, ETH, or SOL.',
      });
    }
    
    logger.error('Failed to create payment', { error, userId: req.userId });
    next(error);
  }
});

/**
 * GET /api/payments
 * List user's payments
 */
paymentsRouter.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;
    
    const where: any = { userId: req.userId! };
    if (status) {
      where.status = status;
    }
    
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          merchant: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get payments', { error, userId: req.userId });
    next(error);
  }
});

/**
 * GET /api/payments/:id
 * Get payment details
 */
paymentsRouter.get('/:id', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
      include: {
        merchant: true,
        transaction: true,
      },
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }
    
    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    logger.error('Failed to get payment', { error, paymentId: req.params.id });
    next(error);
  }
});

/**
 * POST /api/payments/:id/process
 * Process payment (send crypto to escrow)
 */
paymentsRouter.post('/:id/process', async (req, res, next) => {
  try {
    const result = await processPayment(req.params.id, req.userId!);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === 'Payment not found or already processed') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    
    logger.error('Failed to process payment', { error, paymentId: req.params.id });
    next(error);
  }
});

/**
 * POST /api/payments/:id/refund
 * Refund a payment
 */
paymentsRouter.post('/:id/refund', async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Refund reason is required',
      });
    }
    
    const payment = await refundPayment(req.params.id, reason);
    
    res.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    if (error.message === 'Payment not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    
    logger.error('Failed to refund payment', { error, paymentId: req.params.id });
    next(error);
  }
});

