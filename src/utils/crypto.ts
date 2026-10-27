/**
 * Privacy & Encryption Module
 * Implements client-side AES-GCM 256-bit encryption using the standard Web Crypto API.
 * Ensures user leads, notes, and browsing history are encrypted locally before persisting.
 */

// Helper: Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive AES-GCM CryptoKey from a passphrase using PBKDF2
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  v: number;
  iv: string;
  salt: string;
  data: string;
}

/**
 * Encrypt arbitrary object or string with AES-GCM
 */
export async function encryptData(data: unknown, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const encodedPlaintext = enc.encode(plaintext);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encodedPlaintext
  );

  const payload: EncryptedPayload = {
    v: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext)
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt ciphertext payload with AES-GCM
 */
export async function decryptData<T = unknown>(encryptedJson: string, passphrase: string): Promise<T> {
  const payload: EncryptedPayload = JSON.parse(encryptedJson);
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.data);

  const key = await deriveKey(passphrase, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource
    },
    key,
    ciphertext as BufferSource
  );

  const dec = new TextDecoder();
  const text = dec.decode(decryptedBuffer);

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Generate a secure device-unique key if user hasn't set custom passphrase
 */
export function getOrCreateDefaultDeviceKey(): string {
  const STORAGE_KEY = 'leadscrape_device_crypt_seed';
  let seed = localStorage.getItem(STORAGE_KEY);
  if (!seed) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    seed = bufferToBase64(array);
    localStorage.setItem(STORAGE_KEY, seed);
  }
  return 'leadscrape-vault-' + seed;
}
