import { Router } from 'express';
import { authRouter } from './auth';
import { walletsRouter } from './wallets';
import { paymentsRouter } from './payments';
import { merchantsRouter } from './merchants';
import { exchangeRouter } from './exchange';

export const router = Router();

router.use('/auth', authRouter);
router.use('/wallets', walletsRouter);
router.use('/payments', paymentsRouter);
router.use('/merchants', merchantsRouter);
router.use('/exchange', exchangeRouter);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TaskForce Wallet API is running',
    timestamp: new Date().toISOString(),
  });
});

