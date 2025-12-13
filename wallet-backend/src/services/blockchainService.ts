import { ethers } from 'ethers';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { getWalletPrivateKey } from './walletService';
import { logger } from '../lib/logger';

// RPC URLs from environment
const ETHEREUM_RPC = process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';
const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BITCOIN_NETWORK = bitcoin.networks.bitcoin; // Use testnet for development

/**
 * Get Ethereum provider
 */
function getEthereumProvider(chain: string = 'ethereum'): ethers.JsonRpcProvider {
  const rpcUrl = chain === 'polygon' ? POLYGON_RPC : ETHEREUM_RPC;
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get Solana connection
 */
function getSolanaConnection(): Connection {
  return new Connection(SOLANA_RPC, 'confirmed');
}

/**
 * Get Ethereum balance
 */
export async function getEthereumBalance(address: string, chain: string = 'ethereum'): Promise<string> {
  try {
    const provider = getEthereumProvider(chain);
    const balance = await provider.getBalance(address);
    return balance.toString();
  } catch (error) {
    logger.error('Failed to get Ethereum balance', { error, address, chain });
    throw error;
  }
}

/**
 * Send Ethereum transaction
 */
export async function sendEthereumTransaction(
  walletId: string,
  userId: string,
  to: string,
  amount: string,
  chain: string = 'ethereum'
): Promise<{ txHash: string; gasUsed: string }> {
  try {
    const privateKey = await getWalletPrivateKey(walletId, userId);
    const provider = getEthereumProvider(chain);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      from: wallet.address,
      to,
      value: amount,
    });
    
    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    
    // Send transaction
    const tx = await wallet.sendTransaction({
      to,
      value: amount,
      gasLimit: gasEstimate,
      gasPrice,
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    return {
      txHash: receipt!.hash,
      gasUsed: receipt!.gasUsed.toString(),
    };
  } catch (error) {
    logger.error('Failed to send Ethereum transaction', { error, walletId, to, amount });
    throw error;
  }
}

/**
 * Get Solana balance
 */
export async function getSolanaBalance(address: string): Promise<string> {
  try {
    const connection = getSolanaConnection();
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance.toString();
  } catch (error) {
    logger.error('Failed to get Solana balance', { error, address });
    throw error;
  }
}

/**
 * Send Solana transaction
 */
export async function sendSolanaTransaction(
  walletId: string,
  userId: string,
  to: string,
  amount: string
): Promise<{ txHash: string; fee: string }> {
  try {
    const privateKey = await getWalletPrivateKey(walletId, userId);
    const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    const connection = getSolanaConnection();
    
    const toPublicKey = new PublicKey(to);
    const lamports = BigInt(amount);
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: toPublicKey,
        lamports: Number(lamports),
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    // Sign transaction
    transaction.sign(keypair);
    
    // Send transaction
    const txHash = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(txHash, 'confirmed');
    
    // Get transaction fee
    const txDetails = await connection.getTransaction(txHash);
    const fee = txDetails?.meta?.fee?.toString() || '0';
    
    return {
      txHash,
      fee,
    };
  } catch (error) {
    logger.error('Failed to send Solana transaction', { error, walletId, to, amount });
    throw error;
  }
}

/**
 * Get Bitcoin balance
 */
export async function getBitcoinBalance(address: string): Promise<string> {
  try {
    // For Bitcoin, we need to use a block explorer API or run a node
    // Using blockstream API for now
    const response = await fetch(`https://blockstream.info/api/address/${address}`);
    const data = await response.json();
    
    // Balance is in satoshis
    const dataTyped = data as any;
    const balance = dataTyped.chain_stats?.funded_txo_sum || 0;
    const spent = dataTyped.chain_stats?.spent_txo_sum || 0;
    const satoshis = balance - spent;
    
    return satoshis.toString();
  } catch (error) {
    logger.error('Failed to get Bitcoin balance', { error, address });
    throw error;
  }
}

/**
 * Send Bitcoin transaction
 */
export async function sendBitcoinTransaction(
  walletId: string,
  userId: string,
  to: string,
  amount: string
): Promise<{ txHash: string; fee: string }> {
  try {
    // Bitcoin transactions are more complex (UTXO management)
    // This is a simplified version - in production, use a proper Bitcoin library
    // that handles UTXO selection, change addresses, etc.
    
    const privateKey = await getWalletPrivateKey(walletId, userId);
    // Bitcoin transaction sending requires proper UTXO management
    // This is a placeholder - use a proper Bitcoin library in production
    // const keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network: BITCOIN_NETWORK });
    
    // Get UTXOs for the address (simplified - use proper UTXO management in production)
    // This is a placeholder - actual implementation needs proper UTXO handling
    
    throw new Error('Bitcoin transaction sending not fully implemented - requires UTXO management');
  } catch (error) {
    logger.error('Failed to send Bitcoin transaction', { error, walletId, to, amount });
    throw error;
  }
}

// Import prisma
import { prisma } from '../lib/prisma';

/**
 * Update wallet balance from blockchain
 */
export async function updateWalletBalance(walletId: string, chain: string, address: string) {
  try {
    let balance: string;
    
    switch (chain) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
        balance = await getEthereumBalance(address, chain);
        break;
      case 'solana':
        balance = await getSolanaBalance(address);
        break;
      case 'bitcoin':
        balance = await getBitcoinBalance(address);
        break;
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
    
    // Update balance in database
    await prisma.balance.updateMany({
      where: {
        walletId,
        chain,
        tokenAddress: null, // Native token
      },
      data: {
        balance,
        lastUpdated: new Date(),
      },
    });
    
    return balance;
  } catch (error) {
    logger.error('Failed to update wallet balance', { error, walletId, chain, address });
    throw error;
  }
}

