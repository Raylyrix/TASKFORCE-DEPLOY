import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getCache, setCache } from '../lib/redis';

const BINANCE_API = 'https://api.binance.com/api/v3';
const COINBASE_API = 'https://api.coinbase.com/v2';

/**
 * Get exchange rate from Binance
 */
async function getBinanceRate(fromCurrency: string, toCurrency: string): Promise<number> {
  try {
    // Convert to Binance symbol format
    const symbol = `${fromCurrency}${toCurrency}`;
    
    const response = await axios.get(`${BINANCE_API}/ticker/price`, {
      params: { symbol },
    });
    
    return parseFloat(response.data.price);
  } catch (error: any) {
    // Try reverse pair
    try {
      const reverseSymbol = `${toCurrency}${fromCurrency}`;
      const response = await axios.get(`${BINANCE_API}/ticker/price`, {
        params: { symbol: reverseSymbol },
      });
      return 1 / parseFloat(response.data.price);
    } catch (reverseError) {
      logger.warn('Binance rate fetch failed', { error, fromCurrency, toCurrency });
      throw error;
    }
  }
}

/**
 * Get exchange rate from Coinbase
 */
async function getCoinbaseRate(fromCurrency: string, toCurrency: string): Promise<number> {
  try {
    const response = await axios.get(`${COINBASE_API}/exchange-rates`, {
      params: { currency: fromCurrency },
    });
    
    const rates = response.data.data.rates;
    const rate = parseFloat(rates[toCurrency]);
    
    if (!rate) {
      throw new Error(`Rate not found for ${toCurrency}`);
    }
    
    return rate;
  } catch (error) {
    logger.warn('Coinbase rate fetch failed', { error, fromCurrency, toCurrency });
    throw error;
  }
}

/**
 * Get exchange rate (tries multiple sources)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  source?: string
): Promise<{ rate: number; source: string }> {
  // Check Redis cache first (30 seconds TTL)
  const cacheKey = `exchange_rate:${fromCurrency}:${toCurrency}`;
  const cached = await getCache(cacheKey);
  
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return {
        rate: parsed.rate,
        source: parsed.source,
      };
    } catch (error) {
      // Invalid cache, continue to fetch
    }
  }
  
  // Fallback to database cache (last 30 seconds)
  const dbCached = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      timestamp: {
        gte: new Date(Date.now() - 30000), // 30 seconds
      },
    },
    orderBy: { timestamp: 'desc' },
  });
  
  if (dbCached) {
    const result = {
      rate: Number(dbCached.rate),
      source: dbCached.source,
    };
    // Update Redis cache
    await setCache(cacheKey, JSON.stringify(result), 30);
    return result;
  }
  
  // Try to fetch from specified source or try all
  let rate: number;
  let rateSource: string;
  
  if (source === 'binance') {
    rate = await getBinanceRate(fromCurrency, toCurrency);
    rateSource = 'binance';
  } else if (source === 'coinbase') {
    rate = await getCoinbaseRate(fromCurrency, toCurrency);
    rateSource = 'coinbase';
  } else {
    // Try Binance first, fallback to Coinbase
    try {
      rate = await getBinanceRate(fromCurrency, toCurrency);
      rateSource = 'binance';
    } catch (error) {
      rate = await getCoinbaseRate(fromCurrency, toCurrency);
      rateSource = 'coinbase';
    }
  }
  
  // Cache the rate in Redis (30 seconds)
  await setCache(cacheKey, JSON.stringify({ rate, source: rateSource }), 30);
  
  // Also cache in database for longer-term storage
  await prisma.exchangeRate.create({
    data: {
      fromCurrency,
      toCurrency,
      rate,
      source: rateSource,
    },
  });
  
  return { rate, source: rateSource };
}

/**
 * Convert amount from one currency to another
 */
export async function convertAmount(
  amount: string,
  fromCurrency: string,
  toCurrency: string
): Promise<{ amount: string; rate: number; source: string }> {
  if (fromCurrency === toCurrency) {
    return {
      amount,
      rate: 1,
      source: 'direct',
    };
  }
  
  const { rate, source } = await getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = (parseFloat(amount) * rate).toFixed(8);
  
  return {
    amount: convertedAmount,
    rate,
    source,
  };
}

/**
 * Get supported currencies
 */
export function getSupportedCurrencies() {
  return {
    crypto: ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'MATIC', 'ARB'],
    fiat: ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
  };
}

