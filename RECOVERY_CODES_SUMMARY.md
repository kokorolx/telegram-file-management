# Recovery Codes - Quick Summary

## What & Why

**Problem**: Currently using login password to reset master password = weak security (mixes two security domains).

**Solution**: Recovery codes - industry standard one-time codes that user generates and stores securely.

**Security gain**: Attacker needs BOTH (1) login password AND (2) recovery code to reset master password. If DB is compromised, codes are hashed so can't be used.

---

## User Experience

### New Users
1. Register → Login → Set Master Password
2. **[NEW] Recovery Code Modal auto-shows:**
   - Displays 10 codes: `XXXX-XXXX-XXXX-XXXX`
   - User must check "I have saved these codes" checkbox
   - User clicks "Got it" to access vault
   - Codes stored in secure location (their choice: written down, printed, saved file)

3. Done! User can now use recovery code if they ever need to reset master password

### Existing Users (Before Launch)
- See optional banner in Settings
- Can click "Generate Now" anytime
- No forced action
- Warning banner appears periodically until they generate

---

## Key Database Fields

### On `users` table
```
recovery_codes_enabled: BOOLEAN
  → TRUE when user has generated codes

recovery_codes_generated_on_first_setup: BOOLEAN
  → TRUE if new user generated codes after setup
  → FALSE if they skipped
  → Prevents re-showing modal on next login
```

### New `recovery_codes` table
```
id: UUID (primary key)
user_id: UUID (foreign key to users)
code_hash: VARCHAR (bcrypt hash)
used: BOOLEAN (prevents reuse)
used_at: TIMESTAMP
created_at: TIMESTAMP
expires_at: TIMESTAMP (1 year default)
burned_reason: VARCHAR (used/expired/revoked)
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/recovery-codes/generate` | POST | Generate 10 new codes (requires login password) |
| `/api/auth/reset-master-with-recovery` | POST | Reset master password using recovery code |
| `/api/auth/recovery-codes` | GET | List user's recovery codes (hashed display) |
| `/api/auth/recovery-codes/revoke` | POST | Revoke all codes (requires login password) |

---

## Components to Build

| Component | Purpose |
|-----------|---------|
| `RecoveryCodeModal.jsx` | Shows codes after setup, handles download/print |
| `RecoveryCodeSettings.jsx` | Settings page for recovery code management |
| `RecoveryCodeWarningBanner.jsx` | Reminder banner if user skipped generation |
| `ResetMasterPasswordModal.jsx` (modified) | Add recovery code input option |
| `SetupModal.jsx` (modified) | Add callback to trigger recovery code modal |

---

## Database Migration

Single migration file: `004_add_recovery_codes.sql`

```sql
-- Add fields to users
ALTER TABLE users ADD COLUMN recovery_codes_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN recovery_codes_generated_on_first_setup BOOLEAN DEFAULT FALSE;

-- New table for codes
CREATE TABLE recovery_codes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash VARCHAR(255),
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  burned_reason VARCHAR(50)
);
```

---

## Testing Critical Path

```
New User Flow:
1. Register → Login
2. Setup modal appears → enter master password
3. Recovery code modal auto-shows ✓
4. User can copy/download/print codes ✓
5. User checks checkbox + clicks "Got it" ✓
6. Modal closes, user in vault ✓
7. recovery_codes_enabled = TRUE in DB ✓
8. Codes hashed in recovery_codes table ✓

Recovery Code Usage:
1. User goes to Settings → Reset Master Password
2. Enters login password ✓
3. Enters recovery code ✓
4. Sets new master password ✓
5. Code burned (used = TRUE, burned_reason = 'used') ✓

Existing User Optional Flow:
1. User sees banner in Settings
2. Clicks "Generate Now"
3. Prompted for login password
4. Recovery code modal shows
5. User saves codes (same as new user) ✓
```

---

## Timeline

| Week | Tasks |
|------|-------|
| Week 1 | DB schema + RecoveryCodeService |
| Week 2 | API endpoints |
| Week 3 | Frontend components + modals |
| Week 4 | Settings integration |
| Week 5 | Testing + documentation |
| Week 6 | Soft launch (feature flag) |
| Week 7 | Remove flag + monitor adoption |

---

## Important Notes

✅ **DO**: Recovery codes are one-time use only
✅ **DO**: Hash codes like passwords (bcrypt)
✅ **DO**: Require login password when using recovery code
✅ **DO**: Auto-show modal to new users after setup
✅ **DO**: Keep login password method for 6 months (backward compat)

❌ **DON'T**: Allow code reuse
❌ **DON'T**: Store codes in plaintext
❌ **DON'T**: Allow recovery code use without login password
❌ **DON'T**: Force existing users to generate codes
❌ **DON'T**: Allow password reset with just recovery code (need login password too)

---

## Monitoring

Track these metrics:
- % of new users generating codes on first setup
- % of existing users who opt-in
- Recovery code usage rate
- Code expiration rate
- Brute force attempts (rate limit at 5 attempts/hour)

Alert on:
- High failure rate during code verification
- Suspicious usage patterns
- DB errors in recovery_codes table
- Expired codes not cleaning up

---

## Files to Create/Modify

### New Files
- `lib/recoveryCodeService.js` - Service class
- `app/components/RecoveryCodeModal.jsx` - Modal
- `app/components/RecoveryCodeSettings.jsx` - Settings section
- `app/components/RecoveryCodeWarningBanner.jsx` - Banner
- `app/api/auth/recovery-codes/generate/route.js` - API
- `app/api/auth/recovery-codes/[id]/revoke/route.js` - API
- `db/migrations/004_add_recovery_codes.sql` - Migration
- `MASTER_PASSWORD_RECOVERY_PLAN.md` - This plan
- `RECOVERY_CODES_IMPLEMENTATION_CHECKLIST.md` - Checklist

### Modified Files
- `lib/repositories/UserRepository.js` - Add methods
- `app/components/SetupModal.jsx` - Add callback
- `app/components/ResetMasterPasswordModal.jsx` - Add recovery code option
- `app/[[...folderPath]]/page.jsx` - Trigger recovery modal after setup
- `docs/SECURITY.md` - Document recovery mechanism

---

## Related Documents

- `MASTER_PASSWORD_RECOVERY_PLAN.md` - Full detailed plan
- `RECOVERY_CODES_IMPLEMENTATION_CHECKLIST.md` - Phase-by-phase checklist
- `RECOVERY_CODES_SUMMARY.md` - This file (quick reference)

