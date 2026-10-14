/**
 * Badge signing and verification
 * Uses Ed25519 (tweetnacl) if keys provided, otherwise HMAC-SHA256
 */

import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import logger from './logger';

// Signing method: 'ed25519' or 'hmac'
let signingMethod: 'ed25519' | 'hmac' = 'hmac';
let ed25519KeyPair: nacl.SignKeyPair | null = null;

// Initialize signing method
function initializeSigner() {
    const privateKeyB64 = process.env.BADGE_PRIVATE_KEY;
    const publicKeyB64 = process.env.BADGE_PUBLIC_KEY;

    if (privateKeyB64 && publicKeyB64) {
        try {
            const secretKey = naclUtil.decodeBase64(privateKeyB64);
            const publicKey = naclUtil.decodeBase64(publicKeyB64);

            ed25519KeyPair = {
                secretKey,
                publicKey,
            };

            signingMethod = 'ed25519';
            logger.info('Badge signer initialized with Ed25519');
        } catch (err) {
            logger.error({ err }, 'Failed to parse Ed25519 keys, falling back to HMAC');
            signingMethod = 'hmac';
        }
    } else {
        logger.info('Ed25519 keys not configured, using HMAC-SHA256 for badge signing');
        signingMethod = 'hmac';
    }
}

// Initialize on module load
initializeSigner();

/**
 * Sign badge payload
 */
export function signBadge(payload: Record<string, unknown>): string {
    const message = JSON.stringify(payload);

    if (signingMethod === 'ed25519' && ed25519KeyPair) {
        // Sign with Ed25519
        const messageUint8 = naclUtil.decodeUTF8(message);
        const signature = nacl.sign.detached(messageUint8, ed25519KeyPair.secretKey);
        return naclUtil.encodeBase64(signature);
    } else {
        // Sign with HMAC-SHA256
        const secret = process.env.BADGE_SIGNING_SECRET || 'dev-secret-change-in-production';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(message);
        return hmac.digest('base64');
    }
}

/**
 * Verify badge signature
 */
export function verifyBadge(payload: Record<string, unknown>, signature: string): boolean {
    try {
        const message = JSON.stringify(payload);

        if (signingMethod === 'ed25519' && ed25519KeyPair) {
            // Verify with Ed25519
            const messageUint8 = naclUtil.decodeUTF8(message);
            const signatureUint8 = naclUtil.decodeBase64(signature);
            return nacl.sign.detached.verify(messageUint8, signatureUint8, ed25519KeyPair.publicKey);
        } else {
            // Verify with HMAC-SHA256
            const expectedSignature = signBadge(payload);
            return expectedSignature === signature;
        }
    } catch (err) {
        logger.error({ err }, 'Badge verification error');
        return false;
    }
}

/**
 * Generate badge ID
 */
export function generateBadgeId(): string {
    return `badge_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Get signing method (for debugging)
 */
export function getSigningMethod(): 'ed25519' | 'hmac' {
    return signingMethod;
}
