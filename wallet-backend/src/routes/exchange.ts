import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { getExchangeRate, convertAmount, getSupportedCurrencies } from '../services/exchangeService';
import { logger } from '../lib/logger';

export const exchangeRouter = Router();

// Optional auth (for rate limiting)
exchangeRouter.use(optionalAuth);

const convertSchema = z.object({
  amount: z.string(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
});

/**
 * GET /api/exchange/rates
 * Get exchange rates
 */
exchangeRouter.get('/rates', async (req, res, next) => {
  try {
    const fromCurrency = req.query.from as string;
    const toCurrency = req.query.to as string;
    
    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        error: 'from and to currency parameters are required',
      });
    }
    
    const rate = await getExchangeRate(fromCurrency.toUpperCase(), toCurrency.toUpperCase());
    
    res.json({
      success: true,
      data: rate,
    });
  } catch (error) {
    logger.error('Failed to get exchange rate', { error });
    next(error);
  }
});

/**
 * POST /api/exchange/convert
 * Convert amount between currencies
 */
exchangeRouter.post('/convert', async (req, res, next) => {
  try {
    const body = convertSchema.parse(req.body);
    
    const result = await convertAmount(
      body.amount,
      body.fromCurrency.toUpperCase(),
      body.toCurrency.toUpperCase()
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Failed to convert amount', { error });
    next(error);
  }
});

/**
 * GET /api/exchange/currencies
 * Get supported currencies
 */
exchangeRouter.get('/currencies', async (req, res) => {
  const currencies = getSupportedCurrencies();
  
  res.json({
    success: true,
    data: currencies,
  });
});

