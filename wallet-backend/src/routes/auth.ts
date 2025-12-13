import { Router } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, logoutUser } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { logger } from '../lib/logger';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
authRouter.post('/register', async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === 'User already exists') {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Registration error', { error });
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('Login error', { error });
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
authRouter.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.substring(7);
    if (token) {
      await logoutUser(token);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', { error });
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    logger.error('Get user error', { error });
    next(error);
  }
});

