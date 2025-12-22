# Recovery Codes Implementation Guide

## Quick Links to Documentation

### For Understanding the Plan
1. **[RECOVERY_CODES_SUMMARY.md](./RECOVERY_CODES_SUMMARY.md)** ← **START HERE** (2 min read)
   - What, why, and quick overview
   - Key database fields
   - Component list
   - Testing checklist

### For Detailed Planning
2. **[MASTER_PASSWORD_RECOVERY_PLAN.md](./MASTER_PASSWORD_RECOVERY_PLAN.md)** (30 min read)
   - Complete security analysis
   - Comparison with alternatives
   - Implementation phases
   - New user journey diagram

3. **[RECOVERY_CODES_USER_ONBOARDING.md](./RECOVERY_CODES_USER_ONBOARDING.md)** (20 min read)
   - How users see the feature
   - UI mockups
   - Timeline for existing users
   - Testing strategy from user perspective

### For Implementation
4. **[RECOVERY_CODES_ARCHITECTURE.md](./RECOVERY_CODES_ARCHITECTURE.md)** (20 min read)
   - System diagram (frontend → backend → DB)
   - Data flows (generate, verify, burn)
   - Code lifecycle
   - Performance considerations

5. **[RECOVERY_CODES_IMPLEMENTATION_CHECKLIST.md](./RECOVERY_CODES_IMPLEMENTATION_CHECKLIST.md)** (reference guide)
   - Detailed phase-by-phase checklist
   - All files to create/modify
   - Testing checkpoints
   - Sign-off criteria

---

## The Problem

Current system uses login password to reset master password:
- ❌ Conflates two security domains
- ❌ If login password compromised, so is encryption key
- ❌ No separate recovery mechanism
- ❌ Violates principle of least privilege

## The Solution

Recovery codes (industry best practice):
- ✅ One-time use codes, hashed like passwords
- ✅ Separate from login password
- ✅ User controls when codes are generated
- ✅ Codes are burned after use (can't be reused)
- ✅ Code + login password both required to reset encryption

---

## Implementation at a Glance

### What Gets Built

**Backend**
- `RecoveryCodeService` - manage codes (generate, verify, burn)
- 4 API endpoints (generate, reset-with-code, list, revoke)
- Database schema (recovery_codes table)
- Database migration script

**Frontend**
- `RecoveryCodeModal` - displays codes, download/print
- `RecoveryCodeSettings` - settings page section
- `RecoveryCodeWarningBanner` - reminder if user skips
- Modifications to existing modals

**Database**
- Add 3 fields to users table
- Create recovery_codes table
- Add indexes for performance

### Timeline

- **Week 1**: DB + Service
- **Week 2**: API endpoints  
- **Week 3**: Frontend components
- **Week 4**: Settings integration
- **Week 5**: Testing + docs
- **Week 6**: Soft launch (feature flag)
- **Week 7**: Remove flag, monitor

---

## Critical Requirements

### For NEW Users
✅ **MUST show RecoveryCodeModal immediately after SetupModal**
- Auto-triggered (no skip entirely option)
- User either: save codes + proceed, or skip + warning shows later
- Codes stored in DB, plaintext cleared from memory
- `recovery_codes_generated_on_first_setup` flag tracks status

### For EXISTING Users
✅ **MUST provide gentle opt-in (no forcing)**
- Optional banner in Settings (dismissible)
- Button: "Generate Now"
- Smart reminders (banner reappears after 7 days)
- No blocking of vault access

### Security
✅ **MUST require login password to use recovery code**
- Code alone is not enough to reset master password
- Protects against attackers with only DB access
- Hashed codes prevent brute force from DB

✅ **MUST enforce one-time use**
- Code burns after being used
- `used` flag + `burned_reason` prevent reuse

---

## Database Changes Summary

### Migration File: `db/migrations/004_add_recovery_codes.sql`

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN recovery_codes_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN recovery_codes_generated_on_first_setup BOOLEAN DEFAULT FALSE;

-- New table
CREATE TABLE recovery_codes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  code_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 year'),
  burned_reason VARCHAR(50),
  INDEX(user_id, used)
);
```

---

## API Endpoints Summary

### POST /api/auth/recovery-codes/generate
Generate 10 new recovery codes for user.
- **Requires**: Authenticated user + login password verification
- **Response**: { success, codes: [...], expiresAt }

### POST /api/auth/reset-master-with-recovery
Reset master password using recovery code.
- **Requires**: Login password + recovery code + new master password
- **Does**: Verifies code, updates password, burns code
- **Response**: { success, codesRemaining }

### GET /api/auth/recovery-codes
List user's recovery codes.
- **Requires**: Authenticated user
- **Response**: { enabled, generatedAt, codesRemaining, codes: [...] }

### POST /api/auth/recovery-codes/revoke
Revoke all unused recovery codes.
- **Requires**: Authenticated user + login password verification
- **Response**: { success }

---

## Key Features

| Feature | Behavior |
|---------|----------|
| **Generation** | User generates 10 codes, must save them |
| **Storage** | Codes hashed in DB (bcrypt), plaintext never stored |
| **One-Time Use** | After use, code is burned (used=TRUE) |
| **Expiration** | 1 year from creation (configurable) |
| **Security** | Code + login password both required |
| **Audit** | All events logged (generated/used/revoked) |
| **Recovery** | Lost codes cannot be recovered (by design) |
| **Rotation** | User can generate new codes anytime (revokes old) |

---

## User Flows

### New User First-Time Setup
```
Register → Login → SetupModal (master password)
→ RecoveryCodeModal (generate codes) [automatic]
→ User saves codes
→ User checks confirmation + clicks "Got it"
→ Access vault
```

### New User Who Skips Recovery Codes
```
Register → Login → SetupModal → RecoveryCodeModal
→ User clicks "Skip for Now"
→ Access vault
→ Next login: warning banner shows
→ User can click "Generate Now" anytime
```

### Existing User Opting In
```
Login → Settings → "Recovery & Security"
→ Click "Generate Now"
→ Enter login password
→ RecoveryCodeModal shows
→ Save codes
→ Done
```

### Using Recovery Code to Reset Master Password
```
Forgot master password → Login to account
→ Settings → "Reset Master Password"
→ Choose: Use recovery code (instead of login password method)
→ Enter login password + recovery code
→ Set new master password
→ Code is burned, can't be reused
```

---

## Testing Checklist (High Level)

**New User Flow**
- [ ] Register → Setup → Modal auto-shows
- [ ] Copy, download, print work
- [ ] Can't proceed without checkbox
- [ ] Codes stored as hashed in DB
- [ ] Flag set correctly

**Existing User**
- [ ] Banner visible in Settings
- [ ] Generate codes works
- [ ] Same modal as new users

**Code Usage**
- [ ] Code works to reset master password
- [ ] Code burns after use (can't reuse)
- [ ] Requires login password + recovery code

**Edge Cases**
- [ ] Code expiration enforced
- [ ] Revoked codes don't work
- [ ] Rate limiting on attempts
- [ ] Proper error messages

See `RECOVERY_CODES_IMPLEMENTATION_CHECKLIST.md` for detailed checklist.

---

## Files to Create

### New Files (Backend)
```
lib/recoveryCodeService.js
lib/recoveryCodeRepository.js (optional, if not using UserRepository)

app/api/auth/recovery-codes/generate/route.js
app/api/auth/recovery-codes/revoke/route.js
app/api/auth/recovery-codes/verify/route.js (internal)

db/migrations/004_add_recovery_codes.sql

scripts/cleanup-expired-codes.js (cron job)
```

### New Files (Frontend)
```
app/components/RecoveryCodeModal.jsx
app/components/RecoveryCodeSettings.jsx
app/components/RecoveryCodeWarningBanner.jsx

app/components/__tests__/RecoveryCodeModal.test.jsx (optional)
```

### Files to Modify
```
lib/repositories/UserRepository.js
  + add methods for recovery code tracking

app/components/SetupModal.jsx
  + add onSetupComplete callback

app/components/ResetMasterPasswordModal.jsx
  + add recovery code input option

app/[[...folderPath]]/page.jsx
  + import RecoveryCodeModal
  + trigger after SetupModal completes

app/components/SettingsPanel.jsx
  + import and include RecoveryCodeSettings

docs/SECURITY.md
  + add section on recovery codes
```

---

## Environment Variables (Optional)

```bash
# Feature flag (optional, start with true)
FEATURE_RECOVERY_CODES_ENABLED=true

# Recovery code settings
RECOVERY_CODE_COUNT=10              # codes to generate
RECOVERY_CODE_EXPIRY_DAYS=365       # days until code expires
RECOVERY_CODE_RATE_LIMIT=5          # max attempts per hour
RECOVERY_CODE_RATE_LIMIT_WINDOW=3600 # seconds (1 hour)
```

---

## Monitoring & Metrics

### Track These
- % of new users generating codes on first setup
- % of existing users who opt-in
- Daily recovery code generation count
- Daily recovery code usage count
- Code expiration rate
- Brute force attempts (should be low due to rate limiting)

### Alert On
- High failure rate during code verification
- Unusual usage patterns
- Database errors
- Expired codes not cleaning up

### Dashboard
- New users with codes (completion %)
- Existing users with codes (adoption %)
- Code age distribution
- Most common usage time

---

## Migration Plan (Existing Users)

**Week 1-2: Announcement**
- Blog post: "Introducing Recovery Codes"
- In-app notification in Settings
- Email to users (optional)

**Week 2-4: Soft Rollout**
- Optional "Generate Now" button in Settings
- Gentle banner with dismiss option
- Monitor adoption

**Week 3+: Smart Reminders**
- Banner reappears after 7 days (if skipped)
- Becomes more prominent after 30 days
- Optional email reminder after 14 days

**Month 6: Soft Deprecation**
- Announce timeline for deprecating login password method
- Show warning when using login password reset
- Encourage migration to recovery codes

**Month 9+: Hard Deprecation** (if adoption > 80%)
- Disable login password reset method
- Force users to use recovery codes

---

## Security Model

### Recovery codes are protected by:
1. **Hashing**: bcrypt (same strength as password hashes)
2. **One-time use**: Code burned after use
3. **Time limit**: 1-year expiration
4. **Dual authentication**: Code + login password required
5. **Rate limiting**: 5 attempts per hour per user
6. **Audit logging**: All events tracked

### Threats mitigated:
- ✅ DB breach: codes are hashed, can't be used without plaintext
- ✅ Phishing login password: recovery code still required
- ✅ Account lockout: user can use recovery code instead
- ✅ Lost codes: user can generate new ones
- ✅ Code reuse: burned after use

### What's NOT protected by recovery codes:
- ❌ Forgotten master password: codes don't help recover old files
- ❌ Stolen plaintext codes: should be stored securely by user
- ❌ Compromised browser: session could be hijacked

---

## Questions?

Refer to:
- **Quick overview**: RECOVERY_CODES_SUMMARY.md
- **Full plan**: MASTER_PASSWORD_RECOVERY_PLAN.md
- **Implementation checklist**: RECOVERY_CODES_IMPLEMENTATION_CHECKLIST.md
- **User experience**: RECOVERY_CODES_USER_ONBOARDING.md
- **Architecture**: RECOVERY_CODES_ARCHITECTURE.md

---

## Sign-Off Checklist

Before launching:
- [ ] All documents reviewed
- [ ] Design approved
- [ ] Security review passed
- [ ] Database migration tested
- [ ] All components built & tested
- [ ] API endpoints tested
- [ ] Feature flag working
- [ ] Monitoring set up
- [ ] User docs ready
- [ ] Ready for production rollout

