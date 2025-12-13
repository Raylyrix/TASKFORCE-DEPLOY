import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import { encrypt, decrypt } from '../lib/encryption';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

// Bitcoin wallet derivation (simplified - use proper implementation in production)
let bip32: any;
try {
  // Try to use tiny-secp256k1, fallback to simpler implementation
  const ecc = require('tiny-secp256k1');
  bip32 = BIP32Factory(ecc);
} catch (error) {
  // Fallback for Bitcoin - use ethers for Ethereum, direct for Solana
  logger.warn('tiny-secp256k1 not available, Bitcoin wallet creation may be limited');
}

/**
 * Generate a new mnemonic (12 or 24 words)
 */
export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39.generateMnemonic(strength);
}

/**
 * Validate mnemonic
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Derive Ethereum wallet from mnemonic
 */
export function deriveEthereumWallet(mnemonic: string, index: number = 0): {
  address: string;
  privateKey: string;
} {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const path = `m/44'/60'/0'/0/${index}`;
  const child = root.derivePath(path);
  
  if (!child.privateKey) {
    throw new Error('Failed to derive private key');
  }
  
  const wallet = new ethers.Wallet(child.privateKey);
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Derive Solana wallet from mnemonic
 */
export function deriveSolanaWallet(mnemonic: string, index: number = 0): {
  address: string;
  privateKey: string;
} {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const path = `m/44'/501'/${index}'/0'`;
  const child = root.derivePath(path);
  
  if (!child.privateKey) {
    throw new Error('Failed to derive private key');
  }
  
  const keypair = Keypair.fromSeed(child.privateKey);
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
  };
}

/**
 * Derive Bitcoin wallet from mnemonic
 */
export function deriveBitcoinWallet(mnemonic: string, index: number = 0, network: bitcoin.Network = bitcoin.networks.bitcoin): {
  address: string;
  privateKey: string;
} {
  if (!bip32) {
    throw new Error('Bitcoin wallet derivation not available - tiny-secp256k1 required');
  }
  
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const path = `m/44'/0'/0'/0/${index}`;
  const child = root.derivePath(path);
  
  if (!child.privateKey) {
    throw new Error('Failed to derive private key');
  }
  
  const { address } = bitcoin.payments.p2pkh({
    pubkey: child.publicKey,
    network,
  });
  
  if (!address) {
    throw new Error('Failed to generate Bitcoin address');
  }
  
  return {
    address,
    privateKey: child.privateKey.toString('hex'),
  };
}

/**
 * Create a new wallet for a user
 */
export async function createWallet(
  userId: string,
  chain: 'ethereum' | 'solana' | 'bitcoin',
  mnemonic?: string
): Promise<{ id: string; address: string }> {
  try {
    // Generate or use provided mnemonic
    let masterMnemonic = mnemonic;
    let isNewMnemonic = false;
    
    // Check if user already has a wallet (to reuse mnemonic)
    const existingWallet = await prisma.wallet.findFirst({
      where: { userId },
      select: { mnemonicEnc: true },
    });
    
    if (existingWallet?.mnemonicEnc) {
      // Reuse existing mnemonic
      masterMnemonic = decrypt(existingWallet.mnemonicEnc);
    } else if (!masterMnemonic) {
      // Generate new mnemonic
      masterMnemonic = generateMnemonic();
      isNewMnemonic = true;
    }
    
    if (!masterMnemonic || !validateMnemonic(masterMnemonic)) {
      throw new Error('Invalid mnemonic');
    }
    
    // Derive wallet based on chain
    let walletData: { address: string; privateKey: string };
    let derivationPath: string;
    
    switch (chain) {
      case 'ethereum':
        walletData = deriveEthereumWallet(masterMnemonic);
        derivationPath = "m/44'/60'/0'/0/0";
        break;
      case 'solana':
        walletData = deriveSolanaWallet(masterMnemonic);
        derivationPath = "m/44'/501'/0'/0'";
        break;
      case 'bitcoin':
        walletData = deriveBitcoinWallet(masterMnemonic);
        derivationPath = "m/44'/0'/0'/0/0";
        break;
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
    
    // Encrypt private key and mnemonic
    const privateKeyEnc = encrypt(walletData.privateKey);
    const mnemonicEnc = isNewMnemonic ? encrypt(masterMnemonic) : undefined;
    
    // Create wallet in database
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        chain,
        address: walletData.address,
        privateKeyEnc,
        derivationPath,
        mnemonicEnc,
      },
    });
    
    // Create default address entry
    await prisma.address.create({
      data: {
        walletId: wallet.id,
        userId,
        chain,
        address: walletData.address,
        isDefault: true,
      },
    });
    
    // Initialize balance
    await prisma.balance.create({
      data: {
        walletId: wallet.id,
        chain,
        tokenAddress: null, // Native token
        tokenSymbol: chain === 'ethereum' ? 'ETH' : chain === 'solana' ? 'SOL' : 'BTC',
        balance: '0',
      },
    });
    
    logger.info('Wallet created', { userId, chain, address: walletData.address });
    
    return {
      id: wallet.id,
      address: walletData.address,
    };
  } catch (error) {
    logger.error('Failed to create wallet', { error, userId, chain });
    throw error;
  }
}

/**
 * Get wallet private key (decrypted)
 */
export async function getWalletPrivateKey(walletId: string, userId: string): Promise<string> {
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: walletId,
      userId, // Security: ensure user owns wallet
    },
  });
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  if (!wallet.privateKeyEnc) {
    throw new Error('Private key not available (hardware wallet)');
  }
  
  return decrypt(wallet.privateKeyEnc);
}

/**
 * Get user's wallets
 */
export async function getUserWallets(userId: string) {
  return prisma.wallet.findMany({
    where: { userId, isActive: true },
    include: {
      balances: {
        orderBy: { lastUpdated: 'desc' },
      },
      _count: {
        select: { transactions: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(walletId: string, userId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: walletId,
      userId,
    },
    include: {
      balances: true,
    },
  });
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  return wallet.balances;
}

