# Recovery Codes Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js + React)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  LoginDialog     │    │   SetupModal     │    │ RecoveryCodeModal    │   │
│  │                  │    │  (master pwd)    │    │                      │   │
│  │ - register       │───→│ - set password   │───→│ - show 10 codes      │   │
│  │ - login          │    │                  │    │ - copy/download      │   │
│  │                  │    │                  │    │ - print              │   │
│  └──────────────────┘    └──────────────────┘    │ - checkbox confirm   │   │
│                                                   │                      │   │
│                                                   └──────────────────────┘   │
│                                                               │               │
│                                                               ↓               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Settings Panel                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │ Recovery & Security Section                                  │   │    │
│  │  │ - Status: enabled/disabled                                  │   │    │
│  │  │ - Generated: 2024-12-21                                     │   │    │
│  │  │ - Remaining: 9 codes                                        │   │    │
│  │  │ - Code list (hashed display)                               │   │    │
│  │  │ - [Generate New] [Revoke All]                              │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌──────────────────┐              ┌──────────────────────────────────┐     │
│  │ ResetMasterPwdModal │           │ RecoveryCodeWarningBanner       │     │
│  │ (modified)       │              │                                  │     │
│  │ - login password │              │ ⚠️ No recovery codes yet!        │     │
│  │ - recovery code  │              │ [Generate Now]                   │     │
│  │ - new pwd        │              │                                  │     │
│  └──────────────────┘              └──────────────────────────────────┘     │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                      │
                    │ HTTP Requests                        │
                    ↓                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Next.js Routes)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  POST /api/auth/recovery-codes/generate                                      │
│  ├─ Check: authenticated user                                               │
│  ├─ Verify: login password                                                  │
│  ├─ Generate: 10 random codes                                               │
│  ├─ Hash: bcrypt each code                                                  │
│  ├─ Store: in recovery_codes table                                          │
│  ├─ Set: recovery_codes_enabled = TRUE                                      │
│  └─ Return: plaintext codes (only time user sees them!)                     │
│                                                                               │
│  POST /api/auth/reset-master-with-recovery                                   │
│  ├─ Check: authenticated user                                               │
│  ├─ Verify: login password                                                  │
│  ├─ Verify: recovery code (against hash)                                    │
│  ├─ Check: not already used & not expired                                   │
│  ├─ Hash: new master password                                               │
│  ├─ Update: user.master_password_hash                                       │
│  ├─ Rotate: user.encryption_salt (new salt = new key!)                      │
│  ├─ Burn: recovery code (used = TRUE, burned_reason = 'used')              │
│  └─ Return: success                                                         │
│                                                                               │
│  GET /api/auth/recovery-codes                                                │
│  ├─ Check: authenticated user                                               │
│  ├─ Fetch: all codes for user                                               │
│  ├─ Format: hash display (XXXX-****-****-GHIJ)                             │
│  └─ Return: list with status (used/unused), expiry, dates                  │
│                                                                               │
│  POST /api/auth/recovery-codes/revoke                                        │
│  ├─ Check: authenticated user                                               │
│  ├─ Verify: login password                                                  │
│  ├─ Burn: all unused codes (burned_reason = 'revoked')                      │
│  └─ Return: success                                                         │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ ORM/Repository Pattern
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER (lib/)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  RecoveryCodeService.js                                                      │
│  ├─ generateCodes(count=10)                                                  │
│  │  └─ Return: { plaintext: [...], hashes: [...] }                          │
│  ├─ saveCodes(userId, hashes, expiresIn)                                    │
│  │  └─ Insert: into recovery_codes + update users.recovery_codes_enabled    │
│  ├─ verifyRecoveryCode(userId, code)                                        │
│  │  └─ Find: matching hash, check used/expiry, return record                │
│  ├─ burnCode(codeId, reason)                                                │
│  │  └─ Update: used=TRUE, used_at=NOW, burned_reason=reason                │
│  ├─ listUserCodes(userId)                                                   │
│  │  └─ Fetch: all codes, mask display, include status                       │
│  ├─ revokeAllCodes(userId)                                                  │
│  │  └─ Burn: all unused codes with 'revoked' reason                         │
│  └─ cleanupExpiredCodes()                                                   │
│     └─ Delete: codes where expires_at < NOW AND burned_reason='expired'     │
│                                                                               │
│  AuthService.js (existing, no changes)                                      │
│  ├─ generateMasterPasswordHash()                                             │
│  ├─ verifyLoginPassword()                                                    │
│  └─ deriveEncryptionKey()                                                    │
│                                                                               │
│  UserRepository.js (modified)                                                │
│  ├─ findById()                                                               │
│  ├─ updateMasterPassword() ← rotates encryption_salt                        │
│  ├─ hasRecoveryCodes()                                                       │
│  └─ setRecoveryCodesGenerated()                                              │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (PostgreSQL)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  users (modified)                                                             │
│  ├─ id: UUID (pk)                                                           │
│  ├─ username: VARCHAR                                                        │
│  ├─ password_hash: VARCHAR (bcrypt - login pwd)                             │
│  ├─ master_password_hash: VARCHAR (bcrypt - encryption pwd)                 │
│  ├─ encryption_salt: VARCHAR (for PBKDF2)                                   │
│  ├─ recovery_codes_enabled: BOOLEAN [NEW]                                   │
│  ├─ recovery_codes_generated_on_first_setup: BOOLEAN [NEW]                  │
│  ├─ last_master_password_change: TIMESTAMP [NEW]                            │
│  └─ updated_at: TIMESTAMP                                                   │
│                                                                               │
│  recovery_codes [NEW]                                                         │
│  ├─ id: UUID (pk)                                                           │
│  ├─ user_id: UUID (fk → users.id)                                           │
│  ├─ code_hash: VARCHAR (bcrypt hash of code)                                │
│  ├─ used: BOOLEAN (prevents one-time use violation)                         │
│  ├─ used_at: TIMESTAMP (when code was used)                                 │
│  ├─ created_at: TIMESTAMP (when generated)                                  │
│  ├─ expires_at: TIMESTAMP (default: created_at + 1 year)                    │
│  ├─ burned_reason: VARCHAR (used|expired|revoked)                           │
│  └─ INDEX(user_id, used) for fast lookups                                   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Generate Recovery Codes

```
User clicks "Generate Recovery Codes"
         │
         ↓
[FE] RecoveryCodeSettings: call handleGenerateClick()
         │
         ↓
[FE] Prompt for login password (if not authenticated with recent action)
         │
         ↓
POST /api/auth/recovery-codes/generate
  └─ body: { loginPassword: "..." }
         │
         ↓
[BE] Check: user authenticated? YES
[BE] Verify: bcrypt.compare(loginPassword, user.password_hash) ✓
         │
         ↓
[BE] Call RecoveryCodeService.generateCodes(10)
  └─ Generate random: crypto.randomBytes(20) × 10
  └─ Format: XXXX-XXXX-XXXX-XXXX
  └─ Hash each: bcrypt.hash(code, 10)
  └─ Return: { plaintext: [...], hashes: [...] }
         │
         ↓
[BE] Call RecoveryCodeService.saveCodes(userId, hashes, expiresIn)
  └─ INSERT into recovery_codes table
  └─ UPDATE users.recovery_codes_enabled = TRUE
         │
         ↓
[BE] Log event: "recovery_codes_generated" (audit)
         │
         ↓
[BE] Response: { success: true, codes: [...plaintext...], expiresAt: "..." }
         │
         ↓
[FE] RecoveryCodeModal displays: 10 plaintext codes
[FE] User can: copy, download, print
[FE] User MUST: check checkbox before proceeding
         │
         ↓
User closes modal / clicks "Got it"
         │
         ↓
[FE] Clear: plaintext codes from memory
[FE] Only hashes stored in DB (not user's browser)
```

---

## Data Flow: Reset Master Password with Recovery Code

```
User needs to reset master password
         │
         ↓
[FE] Settings → Reset Master Password
         │
         ↓
[FE] ResetMasterPasswordModal shows 2 options:
  Option A: Use login password (legacy)
  Option B: Use recovery code (new, if enabled)
         │
User chooses Option B: Use recovery code
         │
         ↓
[FE] Form asks for:
  - login password (identity verification)
  - recovery code (XXXX-XXXX-XXXX-XXXX)
  - new master password
         │
         ↓
POST /api/auth/reset-master-with-recovery
  └─ body: { 
       loginPassword: "...",
       recoveryCode: "XXXX-XXXX-XXXX-XXXX",
       newMasterPassword: "..."
     }
         │
         ↓
[BE] Check: user authenticated? YES
[BE] Verify: bcrypt.compare(loginPassword, user.password_hash) ✓
         │
         ↓
[BE] Call RecoveryCodeService.verifyRecoveryCode(userId, code)
  └─ Find: hash in recovery_codes matching user_id + code
  └─ Check: used == FALSE? YES ✓
  └─ Check: expires_at > NOW? YES ✓
  └─ Return: codeRecord
         │
         ↓
[BE] Hash new master password: authService.generateMasterPasswordHash()
[BE] Generate new salt: randomBytes(16)
         │
         ↓
[BE] UPDATE users table:
  └─ master_password_hash = new_hash
  └─ encryption_salt = new_salt
  └─ last_master_password_change = NOW
         │
    ⚠️ CRITICAL: New salt = new encryption key!
         │ Old files become unreadable unless user knows old master password
         │ This is intentional & documented in warnings
         │
         ↓
[BE] Call RecoveryCodeService.burnCode(codeId, 'used')
  └─ UPDATE recovery_codes:
     └─ used = TRUE
     └─ used_at = NOW
     └─ burned_reason = 'used'
         │
         ↓
[BE] Log event: "recovery_code_used" (audit)
[BE] Log event: "master_password_changed" (audit)
         │
         ↓
[BE] Response: { success: true, message: "Password reset", codesRemaining: 9 }
         │
         ↓
[FE] Show success message
[FE] Redirect to vault / settings
[FE] User's encryption context updated with new master password
         │
         ↓
Done! Code is burned & can never be reused
```

---

## Code Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    RECOVERY CODE LIFECYCLE                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CREATE (user generates codes)                                   │
│  │                                                               │
│  ├─ generate: crypto random                                     │
│  ├─ hash: bcrypt (cost=10)                                      │
│  ├─ store: recovery_codes table                                 │
│  ├─ used: FALSE                                                 │
│  ├─ expires_at: NOW + 1 year                                    │
│  └─ burned_reason: NULL                                         │
│                    │                                            │
│                    ↓                                            │
│           ┌────────────────┐                                    │
│           │ UNUSED & VALID │                                    │
│           └────────────────┘                                    │
│           (can be used to reset password)                       │
│                    │                                            │
│      ┌─────────────┼─────────────┐                             │
│      │             │             │                             │
│      ↓             ↓             ↓                             │
│   USED       REVOKED       EXPIRED                             │
│   (burned)   (burned)      (burned)                            │
│      │             │             │                             │
│      ├─ used: TRUE ├─ used: FALSE ├─ used: FALSE              │
│      ├─ used_at: TS ├─ used_at: NULL ├─ used_at: NULL        │
│      ├─ reason: ├─ reason: ├─ reason:                          │
│      │   'used' │   'revoked' │   'expired'                    │
│      │             │             │                             │
│      └─────────────┴─────────────┘                             │
│                    │                                            │
│                    ↓                                            │
│           ┌────────────────┐                                    │
│           │   DELETED      │                                    │
│           │  (by cleanup)  │                                    │
│           └────────────────┘                                    │
│           (only if: burned_reason IN                           │
│            ('expired', 'revoked') AND                          │
│            created_at < NOW - 30 days)                         │
│                                                                  │
│  Legend:                                                         │
│  TS = timestamp                                                 │
│  NULL = no action taken                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security Checklist

- ✅ Codes hashed with bcrypt (not plaintext)
- ✅ One-time use enforced (used flag)
- ✅ Time-based expiration (1 year)
- ✅ Login password required (can't use code alone)
- ✅ Rate limiting on verification (5 attempts/hour)
- ✅ Audit logging (all events)
- ✅ Recovery code usage doesn't expose master password
- ✅ Lost codes cannot be recovered (by design)
- ✅ Revoking codes prevents reuse
- ✅ New salt generated on reset (new encryption key)

---

## Performance Considerations

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Generate 10 codes | O(10) | bcrypt is slow (intentional) |
| Verify 1 code | O(n) where n=unused codes | Fast index lookup + bcrypt compare |
| List codes | O(n) | Fast index lookup |
| Revoke all | O(n) | Single UPDATE with WHERE clause |
| Cleanup expired | O(n) | Scheduled job, low priority |

**Optimization**: Index on `(user_id, used)` makes verification O(1) in typical case.

---

## Error Handling

```
generateCodes():
├─ 401: Not authenticated
├─ 401: Invalid login password
├─ 500: DB error
└─ 200: Success, return plaintext codes

verifyRecoveryCode():
├─ 400: Code not found
├─ 400: Code already used
├─ 400: Code expired
└─ 200: Code valid, return record

resetMasterWithRecovery():
├─ 401: Not authenticated
├─ 401: Invalid login password
├─ 400: Invalid/expired/used code
├─ 500: DB error (master password update)
└─ 200: Success, code burned

revokeAllCodes():
├─ 401: Not authenticated
├─ 401: Invalid login password
├─ 500: DB error
└─ 200: Success, all codes revoked
```

