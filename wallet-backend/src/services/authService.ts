import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * Register a new user
 */
export async function registerUser(data: z.infer<typeof registerSchema>) {
  const validated = registerSchema.parse(data);
  
  // Check if user exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: validated.email },
        ...(validated.phone ? [{ phone: validated.phone }] : []),
      ],
    },
  });
  
  if (existing) {
    throw new Error('User already exists');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(validated.password, SALT_ROUNDS);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: validated.email,
      phone: validated.phone,
      passwordHash,
      displayName: validated.displayName,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
    },
  });
  
  logger.info('User registered', { userId: user.id, email: user.email });
  
  // Generate token
  const token = generateToken(user.id, user.email);
  
  return {
    user,
    token,
  };
}

/**
 * Login user
 */
export async function loginUser(data: z.infer<typeof loginSchema>) {
  const validated = loginSchema.parse(data);
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: validated.email },
  });
  
  if (!user || !user.isActive) {
    throw new Error('Invalid credentials');
  }
  
  // Verify password
  const isValid = await bcrypt.compare(validated.password, user.passwordHash);
  
  if (!isValid) {
    throw new Error('Invalid credentials');
  }
  
  logger.info('User logged in', { userId: user.id, email: user.email });
  
  // Generate token
  const token = generateToken(user.id, user.email);
  
  // Create session
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    token,
  };
}

/**
 * Generate JWT token
 */
function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * Logout user (invalidate session)
 */
export async function logoutUser(token: string) {
  await prisma.session.deleteMany({
    where: { token },
  });
  
  logger.info('User logged out', { token: token.substring(0, 20) + '...' });
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      displayName: true,
      avatar: true,
      kycStatus: true,
      createdAt: true,
    },
  });
}

