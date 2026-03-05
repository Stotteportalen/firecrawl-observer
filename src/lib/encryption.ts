// Simple encryption utility for API keys
// Uses base64 encoding with obfuscation

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new EncryptionError(
      'ENCRYPTION_KEY not found. Please set it in your environment variables.'
    );
  }

  return key;
}

export async function encrypt(text: string): Promise<string> {
  try {
    const key = getEncryptionKey();

    const reversed = text.split('').reverse().join('');
    let obfuscated = '';

    for (let i = 0; i < reversed.length; i++) {
      obfuscated += reversed[i];
      obfuscated += key[i % key.length];
    }

    const encoded = btoa(obfuscated);

    return 'v1:' + encoded;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(`Encryption failed: ${error}`);
  }
}

export async function decrypt(encryptedText: string): Promise<string> {
  try {
    const _key = getEncryptionKey();

    if (!encryptedText.startsWith('v1:')) {
      throw new EncryptionError('Invalid encrypted format');
    }

    const encoded = encryptedText.substring(3);
    const obfuscated = atob(encoded);

    let reversed = '';
    for (let i = 0; i < obfuscated.length; i += 2) {
      reversed += obfuscated[i];
    }

    const original = reversed.split('').reverse().join('');

    return original;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(`Decryption failed: ${error}`);
  }
}

export function isEncrypted(text: string): boolean {
  return !!text && text.startsWith('v1:');
}
