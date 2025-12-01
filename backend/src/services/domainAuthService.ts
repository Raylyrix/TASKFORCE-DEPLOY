import { PrismaClient } from '@prisma/client';
import dns from 'dns';
import { promisify } from 'util';
import crypto from 'crypto';

const prisma = new PrismaClient();
const resolveTxt = promisify(dns.resolveTxt);

export interface DomainVerificationResult {
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  isVerified: boolean;
  spfRecord?: string;
  dkimRecord?: string;
  dmarcRecord?: string;
  errors: string[];
}

export interface DKIMKeyPair {
  publicKey: string;
  privateKey: string;
  selector: string;
}

/**
 * Generate DKIM key pair for a domain
 */
export async function generateDKIMKeys(domain: string): Promise<DKIMKeyPair> {
  const selector = `taskforce-${Date.now()}`;
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Format public key for DNS (remove headers and whitespace)
  const publicKeyForDNS = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');

  return {
    publicKey: publicKeyForDNS,
    privateKey,
    selector,
  };
}

/**
 * Generate SPF record for a domain
 */
export function generateSPFRecord(mailerDomain: string): string {
  return `v=spf1 include:${mailerDomain} ~all`;
}

/**
 * Generate DMARC record
 */
export function generateDMARCRecord(domain: string, email: string, policy: 'none' | 'quarantine' | 'reject' = 'none'): string {
  return `v=DMARC1; p=${policy}; rua=mailto:${email}; fo=1; ruf=mailto:${email}`;
}

/**
 * Verify SPF record exists in DNS
 */
export async function verifySPF(domain: string, expectedSPF: string): Promise<{ verified: boolean; record?: string; error?: string }> {
  try {
    const records = await resolveTxt(domain);
    const flattened = records.flat().join('');
    
    // Check if expected SPF is present
    const hasSPF = flattened.includes('v=spf1');
    const matchesExpected = flattened.includes(expectedSPF.split(' ')[1]); // Check for include part
    
    return {
      verified: hasSPF && matchesExpected,
      record: flattened,
    };
  } catch (error: any) {
    return {
      verified: false,
      error: error.message,
    };
  }
}

/**
 * Verify DKIM record exists in DNS
 */
export async function verifyDKIM(domain: string, selector: string, publicKey: string): Promise<{ verified: boolean; record?: string; error?: string }> {
  try {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    const records = await resolveTxt(dkimDomain);
    const flattened = records.flat().join('');
    
    // Check if public key is present
    const hasPublicKey = flattened.includes(publicKey.substring(0, 20)); // Check first 20 chars
    
    return {
      verified: hasPublicKey,
      record: flattened,
    };
  } catch (error: any) {
    return {
      verified: false,
      error: error.message,
    };
  }
}

/**
 * Verify DMARC record exists in DNS
 */
export async function verifyDMARC(domain: string, expectedDMARC?: string): Promise<{ verified: boolean; record?: string; error?: string }> {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const records = await resolveTxt(dmarcDomain);
    const flattened = records.flat().join('');
    
    const hasDMARC = flattened.includes('v=DMARC1');
    const matchesExpected = expectedDMARC ? flattened.includes(expectedDMARC) : true;
    
    return {
      verified: hasDMARC && matchesExpected,
      record: flattened,
    };
  } catch (error: any) {
    return {
      verified: false,
      error: error.message,
    };
  }
}

/**
 * Verify all domain authentication records
 */
export async function verifyDomain(
  domain: string,
  spfRecord?: string,
  dkimSelector?: string,
  dkimPublicKey?: string,
  dmarcPolicy?: string
): Promise<DomainVerificationResult> {
  const errors: string[] = [];
  let spfVerified = false;
  let dkimVerified = false;
  let dmarcVerified = false;

  // Verify SPF
  if (spfRecord) {
    const spfResult = await verifySPF(domain, spfRecord);
    spfVerified = spfResult.verified;
    if (!spfVerified && spfResult.error) {
      errors.push(`SPF: ${spfResult.error}`);
    }
  }

  // Verify DKIM
  if (dkimSelector && dkimPublicKey) {
    const dkimResult = await verifyDKIM(domain, dkimSelector, dkimPublicKey);
    dkimVerified = dkimResult.verified;
    if (!dkimVerified && dkimResult.error) {
      errors.push(`DKIM: ${dkimResult.error}`);
    }
  }

  // Verify DMARC
  if (dmarcPolicy) {
    const dmarcResult = await verifyDMARC(domain, dmarcPolicy);
    dmarcVerified = dmarcResult.verified;
    if (!dmarcVerified && dmarcResult.error) {
      errors.push(`DMARC: ${dmarcResult.error}`);
    }
  }

  const isVerified = spfVerified && dkimVerified && dmarcVerified;

  return {
    spfVerified,
    dkimVerified,
    dmarcVerified,
    isVerified,
    errors,
  };
}

/**
 * Get or create sending domain for user
 */
export async function getOrCreateSendingDomain(userId: string, domain: string) {
  const existing = await prisma.sendingDomain.findUnique({
    where: {
      userId_domain: {
        userId,
        domain,
      },
    },
    include: {
      reputation: true,
    },
  });

  if (existing) {
    return existing;
  }

  // Generate DKIM keys
  const dkimKeys = await generateDKIMKeys(domain);
  const selector = dkimKeys.selector;

  // Generate SPF record (using a placeholder mailer domain - should be configurable)
  const mailerDomain = process.env.MAILER_DOMAIN || 'mail.taskforce.app';
  const spfRecord = generateSPFRecord(mailerDomain);

  // Generate DMARC record
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const dmarcEmail = user?.email || `dmarc@${domain}`;
  const dmarcPolicy = generateDMARCRecord(domain, dmarcEmail, 'none');

  const sendingDomain = await prisma.sendingDomain.create({
    data: {
      userId,
      domain,
      spfRecord,
      dkimSelector: selector,
      dkimPublicKey: dkimKeys.publicKey,
      dkimPrivateKey: dkimKeys.privateKey,
      dmarcPolicy,
    },
    include: {
      reputation: true,
    },
  });

  // Create reputation record
  await prisma.domainReputation.create({
    data: {
      sendingDomainId: sendingDomain.id,
    },
  });

  return sendingDomain;
}

/**
 * Sign email with DKIM
 * Note: This is a simplified version. Full DKIM signing requires proper header canonicalization
 */
export function signEmailWithDKIM(
  headers: Record<string, string>,
  body: string,
  domain: string,
  selector: string,
  privateKey: string
): string {
  // This is a placeholder - full DKIM signing is complex
  // For production, use a library like 'dkim-signer' or 'nodemailer-dkim'
  // For now, we'll return the headers as-is
  // TODO: Implement full DKIM signing
  return JSON.stringify(headers);
}




