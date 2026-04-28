import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
};

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    this.key = createHash('sha256').update(rawKey).digest();
  }

  encrypt(value: Record<string, unknown>): EncryptedPayload {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
    };
  }

  decrypt(payload: EncryptedPayload): Record<string, unknown> {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'hex')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
  }
}
