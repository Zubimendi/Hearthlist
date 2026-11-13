// src/lib/id.ts
// 15-character lowercase alphanumeric IDs compatible with PocketBase.
// PocketBase record IDs must be exactly 15 lowercase alphanumeric characters [a-z0-9].

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 15;

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  // 1. Web / React Native (with expo-crypto polyfill) / Node.js standard Web Crypto API
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(bytes);
      return bytes;
    }
  } catch {}

  // 2. Node.js built-in crypto (for Jest / CLI environments)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.randomFillSync === 'function') {
      nodeCrypto.randomFillSync(bytes);
      return bytes;
    }
  } catch {}

  // 3. Guaranteed fallback: pseudo-random numbers
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function newId(): string {
  const bytes = getRandomBytes(ID_LENGTH);
  let result = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}
