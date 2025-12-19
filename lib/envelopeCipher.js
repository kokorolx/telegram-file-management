/**
 * Envelope Encryption Utilities (Browser-side)
 * Handles unique Data Encryption Keys (DEK) and wrapping with Master Password.
 */

const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;

/**
 * Generate a random 256-bit Data Encryption Key (DEK)
 * @returns {Uint8Array}
 */
export function generateDEK() {
    return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Derive a Key Encryption Key (KEK) from a password and salt
 */
async function deriveKEK(password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: encoder.encode(salt),
            iterations: KDF_ITERATIONS
        },
        passwordKey,
        KDF_KEYLEN * 8
    );

    return await crypto.subtle.importKey(
        'raw',
        derivedBits,
        'AES-GCM',
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Wrap a DEK with a password or pre-derived key bits
 * @param {Uint8Array} dek - Data Encryption Key
 * @param {string|Uint8Array} keyMaterial - Password string or derived key bits
 * @param {string} salt - Salt for derivation (ignored if keyMaterial is bits)
 * @returns {Promise<{wrappedKey: string, iv: string}>}
 */
export async function wrapKey(dek, keyMaterial, salt) {
    let kek;
    if (keyMaterial instanceof Uint8Array) {
        // Use pre-derived key directly
        kek = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            'AES-GCM',
            false,
            ['encrypt']
        );
    } else {
        // Derive from password
        kek = await deriveKEK(keyMaterial, salt);
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrapped = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        kek,
        dek
    );

    return {
        wrappedKey: uint8ArrayToBase64(new Uint8Array(wrapped)),
        iv: uint8ArrayToHex(iv)
    };
}

/**
 * Unwrap a DEK using a password or pre-derived key bits
 * @param {string} wrappedKeyBase64
 * @param {string|Uint8Array} keyMaterial - Password string or derived key bits
 * @param {string} salt - Salt for derivation (ignored if keyMaterial is bits)
 * @param {string} ivHex
 * @returns {Promise<Uint8Array>}
 */
export async function unwrapKey(wrappedKeyBase64, keyMaterial, salt, ivHex) {
    let kek;
    if (keyMaterial instanceof Uint8Array) {
        // Use pre-derived key directly
        kek = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            'AES-GCM',
            false,
            ['decrypt']
        );
    } else {
        // Derive from password
        kek = await deriveKEK(keyMaterial, salt);
    }

    const iv = hexToUint8Array(ivHex);
    const wrappedKey = base64ToUint8Array(wrappedKeyBase64);

    const unwrapped = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        kek,
        wrappedKey
    );

    return new Uint8Array(unwrapped);
}

// Helpers
function uint8ArrayToBase64(arr) {
    let binary = '';
    for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
}

function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function uint8ArrayToHex(arr) {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    return bytes;
}
