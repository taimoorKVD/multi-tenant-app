import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getMailEncryptionKey(): Buffer {
  const secret = process.env.MAIL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-mail-secret';
  return createHash('sha256').update(secret).digest();
}

export function encryptMailSecret(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const key = getMailEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptMailSecret(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const [ivPart, tagPart, encryptedPart] = value.split('.');
  if (!ivPart || !tagPart || !encryptedPart) {
    return value;
  }

  const key = getMailEncryptionKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}