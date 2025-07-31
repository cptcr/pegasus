import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 32;
  private readonly iterations = 100000;
  
  private encryptionKey: Buffer;

  constructor() {
    // Get or generate encryption key
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      logger.warn('No encryption key found, generating a new one');
      this.encryptionKey = crypto.randomBytes(this.keyLength);
      logger.info(`Generated encryption key: ${this.encryptionKey.toString('base64')}`);
      logger.warn('Please set ENCRYPTION_KEY environment variable with the above key');
    } else {
      this.encryptionKey = Buffer.from(key, 'base64');
      if (this.encryptionKey.length !== this.keyLength) {
        throw new Error(`Encryption key must be ${this.keyLength} bytes`);
      }
    }
  }

  /**
   * Encrypt data
   */
  encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();
      
      // Combine iv + tag + encrypted data
      const combined = Buffer.concat([iv, tag, encrypted]);
      
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', error as Error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption failed', error as Error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(this.saltLength);
      
      crypto.pbkdf2(password, salt, this.iterations, this.keyLength, 'sha256', (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Combine salt + derived key
        const combined = Buffer.concat([salt, derivedKey]);
        resolve(combined.toString('base64'));
      });
    });
  }

  /**
   * Verify a password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const combined = Buffer.from(hash, 'base64');
      
      // Extract salt
      const salt = combined.slice(0, this.saltLength);
      const storedKey = combined.slice(this.saltLength);
      
      crypto.pbkdf2(password, salt, this.iterations, this.keyLength, 'sha256', (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(crypto.timingSafeEqual(storedKey, derivedKey));
      });
    });
  }

  /**
   * Generate a secure token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Generate a TOTP secret
   */
  generateTOTPSecret(): string {
    const secret = crypto.randomBytes(20);
    return this.base32Encode(secret);
  }

  /**
   * Verify TOTP code
   */
  verifyTOTP(secret: string, code: string, window: number = 1): boolean {
    const decodedSecret = this.base32Decode(secret);
    const time = Math.floor(Date.now() / 1000 / 30);
    
    for (let i = -window; i <= window; i++) {
      const testTime = time + i;
      const expectedCode = this.generateTOTPCode(decodedSecret, testTime);
      
      if (code === expectedCode) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate TOTP code
   */
  private generateTOTPCode(secret: Buffer, time: number): string {
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(time));
    
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code = 
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Base32 encode (for TOTP)
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      
      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    
    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }
    
    return result;
  }

  /**
   * Base32 decode (for TOTP)
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const buffer: number[] = [];
    let bits = 0;
    let value = 0;
    
    for (const char of encoded.toUpperCase()) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;
      
      value = (value << 5) | index;
      bits += 5;
      
      if (bits >= 8) {
        buffer.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    
    return Buffer.from(buffer);
  }

  /**
   * Encrypt object (JSON)
   */
  encryptObject(obj: any): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt object (JSON)
   */
  decryptObject<T = any>(encrypted: string): T {
    return JSON.parse(this.decrypt(encrypted));
  }

  /**
   * Create a signature for data integrity
   */
  sign(data: string): string {
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(data);
    return hmac.digest('base64');
  }

  /**
   * Verify a signature
   */
  verify(data: string, signature: string): boolean {
    const expectedSignature = this.sign(data);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  }
}

// Global encryption service instance
export const encryption = new EncryptionService();