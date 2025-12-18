# Security Model (Zero-Knowledge)

The Telegram File Management system is built on a Zero-Knowledge security model. This document details the cryptographic principles and implementations used to ensure user privacy and data security.

## Principles

1. **Client-Side Encryption**: All files are encrypted in the user's browser before they ever touch the network or the server.
2. **Key Secrecy**: The server never receives or stores the user's master password or the derived encryption keys.
3. **Randomized metadata**: Chunk sizes are randomized (2MB-3MB) to prevent traffic analysis from identifying file types or content patterns.
4. **Authenticity**: Every encrypted chunk is protected by an authentication tag (AES-GCM) to prevent tampering.

## Cryptographic Primitives

### 1. Key Derivation (PBKDF2)
- **Algorithm**: PBKDF2 (Password-Based Key Derivation Function 2).
- **Hash**: SHA-256.
- **Iterations**: 100,000.
- **Salt**: User-specific salt generated during setup and stored on the server.
- **Output**: 256-bit (32-byte) key for AES encryption.

### 2. Encryption (AES-256-GCM)
- **Algorithm**: Advanced Encryption Standard in Galois/Counter Mode.
- **Key Size**: 256 bits.
- **IV Size**: 96 bits (12 bytes), randomly generated for every single chunk.
- **Auth Tag Size**: 128 bits (16 bytes).

## The "Unlock" Workflow

When a user logs in, their vault remains "locked" because the server does not have the encryption key. To unlock the vault:

1. The user enters their **Master Password** in the UI.
2. The browser fetches the user-specific **Encryption Salt** from the server.
3. The browser derives the **256-bit Encryption Key** locally using PBKDF2.
4. The key is stored in the browser's RAM (via React Context) for the duration of the session.
5. On logout or session expiry (1 hour of inactivity), the RAM is cleared, and the key is lost.

## Data Storage Security

### Metadata (PostgreSQL)
The server stores the following metadata for each file part:
- `part_number`: Ordering of the chunk.
- `iv`: The initialization vector used for that specific chunk.
- `auth_tag`: The GCM authentication tag for verification.
- `telegram_file_id`: The opaque ID used to fetch the encrypted blob from Telegram.

None of this information allows the server or an attacker with database access to decrypt the file content.

### Payload (Telegram)
Telegram only stores the encrypted ciphertext. Even if Telegram's servers were compromised, the data remains unreadable without the user's master password.

## Risks & Limitations

- **Master Password Loss**: If a user forgets their master password, there is **no recovery path**. The files are lost forever.
- **Browser Security**: If the user's browser is compromised (e.g., via a malicious extension), the encryption key could be extracted from RAM.
- **Large File Constraints**: Decrypting and reassembling very large files (>1GB) in the browser can be memory-intensive. The system uses streaming (`ReadableStream`) for media playback to mitigate this.
