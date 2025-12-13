import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import crypto from 'crypto';

export const merchantsRouter = Router();

// All routes require authentication
merchantsRouter.use(authenticate);

const createMerchantSchema = z.object({
  businessName: z.string().min(1),
  businessType: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
  swiftCode: z.string().optional(),
  accountHolderName: z.string().optional(),
});

/**
 * POST /api/merchants
 * Register as merchant
 */
merchantsRouter.post('/', async (req, res, next) => {
  try {
    const body = createMerchantSchema.parse(req.body);
    
    // Check if user is already a merchant
    const existing = await prisma.merchant.findFirst({
      where: { userId: req.userId! },
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'User is already registered as merchant',
      });
    }
    
    // Generate unique QR code
    const qrCode = `TASKFORCE-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    
    const merchant = await prisma.merchant.create({
      data: {
        userId: req.userId!,
        businessName: body.businessName,
        businessType: body.businessType,
        phone: body.phone,
        email: body.email,
        address: body.address,
        bankAccount: body.bankAccount,
        bankName: body.bankName,
        ifscCode: body.ifscCode,
        swiftCode: body.swiftCode,
        accountHolderName: body.accountHolderName,
        qrCode,
      },
    });
    
    logger.info('Merchant registered', { merchantId: merchant.id, userId: req.userId });
    
    res.status(201).json({
      success: true,
      data: merchant,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Failed to create merchant', { error, userId: req.userId });
    next(error);
  }
});

/**
 * GET /api/merchants
 * List merchants (user's own merchant account)
 */
merchantsRouter.get('/', async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findFirst({
      where: { userId: req.userId! },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: merchant || null,
    });
  } catch (error) {
    logger.error('Failed to get merchant', { error, userId: req.userId });
    next(error);
  }
});

/**
 * GET /api/merchants/:id
 * Get merchant details
 */
merchantsRouter.get('/:id', async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        qrCode: true,
        // Don't expose sensitive info to public
      },
    });
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
    }
    
    res.json({
      success: true,
      data: merchant,
    });
  } catch (error) {
    logger.error('Failed to get merchant', { error, merchantId: req.params.id });
    next(error);
  }
});

/**
 * GET /api/merchants/qr/:qrCode
 * Get merchant by QR code
 */
merchantsRouter.get('/qr/:qrCode', async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findFirst({
      where: {
        qrCode: req.params.qrCode,
        isActive: true,
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        qrCode: true,
      },
    });
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
    }
    
    res.json({
      success: true,
      data: merchant,
    });
  } catch (error) {
    logger.error('Failed to get merchant by QR', { error, qrCode: req.params.qrCode });
    next(error);
  }
});

/**
 * PUT /api/merchants/:id
 * Update merchant details
 */
merchantsRouter.put('/:id', async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
    }
    
    const body = createMerchantSchema.partial().parse(req.body);
    
    const updated = await prisma.merchant.update({
      where: { id: req.params.id },
      data: body,
    });
    
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Failed to update merchant', { error, merchantId: req.params.id });
    next(error);
  }
});

/**
 * GET /api/merchants/:id/payments
 * Get merchant payments
 */
merchantsRouter.get('/:id/payments', async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
    }
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;
    
    const where: any = { merchantId: req.params.id };
    if (status) {
      where.status = status;
    }
    
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
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
    logger.error('Failed to get merchant payments', { error, merchantId: req.params.id });
    next(error);
  }
});

