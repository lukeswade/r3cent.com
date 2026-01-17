// AES-GCM encryption for OAuth tokens
// Uses Web Crypto API (available in Workers)

export interface EncryptedToken {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64 (included in ciphertext for GCM)
}

// Convert hex key string to CryptoKey
async function getKey(keyHex: string): Promise<CryptoKey> {
  // Key should be 32 bytes (64 hex chars) for AES-256
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a token
export async function encryptToken(
  plaintext: string,
  keyHex: string
): Promise<EncryptedToken> {
  const key = await getKey(keyHex);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // In GCM mode, the auth tag is appended to the ciphertext
  // We'll store the full ciphertext (including tag)
  const ciphertextWithTag = new Uint8Array(encrypted);
  
  // For compatibility, we can separate them (tag is last 16 bytes)
  const ciphertext = ciphertextWithTag.slice(0, -16);
  const tag = ciphertextWithTag.slice(-16);
  
  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tag)),
  };
}

// Decrypt a token
export async function decryptToken(
  encrypted: EncryptedToken,
  keyHex: string
): Promise<string> {
  const key = await getKey(keyHex);
  
  // Decode from base64
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(encrypted.tag), (c) => c.charCodeAt(0));
  
  // Reconstruct ciphertext with tag for GCM
  const ciphertextWithTag = new Uint8Array([...ciphertext, ...tag]);
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextWithTag
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Generate a random encryption key (for setup)
export function generateEncryptionKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(keyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
