# Recovery Codes Implementation Checklist

## Phase 1: Database Schema & Service

### Database
- [ ] Create migration: `004_add_recovery_codes.sql`
  - [ ] Add `recovery_codes_enabled` to users
  - [ ] Add `recovery_codes_generated_on_first_setup` to users
  - [ ] Add `last_master_password_change` to users
  - [ ] Create `recovery_codes` table
  - [ ] Create indexes on recovery_codes table
  - [ ] Test migration (forward & rollback)

### RecoveryCodeService
- [ ] Create `lib/recoveryCodeService.js`
  - [ ] `generateCodes(count=10)` - returns plaintext + hashes
  - [ ] `saveCodes(userId, codeHashes, expiresIn)` - stores in DB
  - [ ] `verifyRecoveryCode(userId, code)` - validates + checks expiry
  - [ ] `burnCode(codeId, reason)` - marks as used
  - [ ] `listUserCodes(userId)` - shows hashed display format
  - [ ] `revokeAllCodes(userId)` - revokes unused codes
  - [ ] `cleanupExpiredCodes()` - cron-safe cleanup
  - [ ] Unit tests for all methods

### UserRepository Update
- [ ] Add method: `hasRecoveryCodes(userId)`
- [ ] Add method: `setRecoveryCodesGenerated(userId, flag)`

---

## Phase 2: API Endpoints

### POST /api/auth/recovery-codes/generate
- [ ] Implement endpoint
- [ ] Requires: authenticated user + login password verification
- [ ] Response: plaintext codes + expiry date
- [ ] Logs event: "recovery_codes_generated"
- [ ] Tests: auth, password validation, error cases

### POST /api/auth/reset-master-with-recovery
- [ ] Implement endpoint
- [ ] Requires: authenticated user + login password + recovery code
- [ ] Updates master password hash & salt
- [ ] Burns recovery code
- [ ] Logs event: "recovery_code_used"
- [ ] Tests: code verification, one-time use, expiry

### GET /api/auth/recovery-codes
- [ ] Implement endpoint
- [ ] Returns: enabled status, code list, expiry, remaining count
- [ ] Masks codes (show last 4 chars only)
- [ ] Shows used/unused status
- [ ] Tests: auth, data format

### POST /api/auth/recovery-codes/revoke
- [ ] Implement endpoint
- [ ] Requires: authenticated user + login password verification
- [ ] Revokes all unused codes
- [ ] Logs event: "recovery_codes_revoked"
- [ ] Tests: auth, revocation

---

## Phase 3: Frontend Components

### RecoveryCodeModal.jsx
- [ ] Create new component
- [ ] Display 10 codes in XXXX-XXXX-XXXX-XXXX format
- [ ] Warning box with critical information
- [ ] Copy-to-clipboard for each code
- [ ] Download as .txt file
- [ ] Print functionality
- [ ] "I have saved codes" checkbox (required to proceed)
- [ ] Buttons: "Got it - Access Vault" (enabled only if checkbox), "Skip for Now"
- [ ] Styling matches SetupModal (blue gradient theme)
- [ ] Mobile responsive
- [ ] Tests: functionality, accessibility

### SetupModal.jsx Modifications
- [ ] Add `onSetupComplete` callback
- [ ] Emit event when master password setup finishes
- [ ] Pass `recovery_codes_generated_on_first_setup` flag from backend
- [ ] Tests: callback firing, integration

### RecoveryCodeSettings.jsx
- [ ] Create new component (for Settings panel)
- [ ] Section: "Recovery & Security"
- [ ] Status display: enabled/disabled
- [ ] "Generated on" date
- [ ] "Remaining codes" count
- [ ] Code list (hashed display)
- [ ] Button: "Generate New Codes" (revokes old ones)
- [ ] Button: "Revoke All Codes"
- [ ] Link to help docs
- [ ] Tests: display, button actions

### RecoveryCodeWarningBanner.jsx
- [ ] Create banner component
- [ ] Shows when recovery codes not generated
- [ ] "Generate Now" button
- [ ] "Dismiss" button (hides until next session)
- [ ] Display locations:
  - [ ] Top of main dashboard
  - [ ] Settings panel
- [ ] Tests: visibility logic, dismissal

### SettingsPanel.jsx Modifications
- [ ] Import RecoveryCodeSettings
- [ ] Add to settings menu/tabs
- [ ] Include warning badge if codes not generated
- [ ] Tests: rendering, integration

### ResetMasterPasswordModal.jsx Modifications
- [ ] Add conditional UI:
  - [ ] If recovery codes enabled: show recovery code input + login password
  - [ ] If recovery codes disabled: show login password only (legacy)
- [ ] Update logic to handle both flows
- [ ] Tests: both flows, validation

---

## Phase 4: Context & State Management

### EncryptionContext or UserContext
- [ ] Add state: `hasRecoveryCodes`
- [ ] Add method: `checkRecoveryCodeStatus()`
- [ ] Add method: `refreshRecoveryCodeList()`
- [ ] Add state: `recovery_codes_generated_on_first_setup`
- [ ] Tests: state updates, context availability

### Page.jsx Modifications
- [ ] After SetupModal completes, check recovery code status
- [ ] If not generated on first setup:
  - [ ] Trigger RecoveryCodeModal
  - [ ] OR show warning banner on dashboard
- [ ] Tests: flow triggering, modal display

---

## Phase 5: Feature Flag (Optional)

### Feature Flag Setup
- [ ] Define flag: `FEATURE_RECOVERY_CODES_ENABLED`
- [ ] Create environment variable for toggle
- [ ] Wrap all recovery code UI behind flag
- [ ] Wrap API endpoints behind flag (return 404 if disabled)
- [ ] Tests: flag on/off scenarios

---

## Phase 6: Testing

### Unit Tests
- [ ] RecoveryCodeService (all methods)
- [ ] API endpoint validation
- [ ] Recovery code hashing (bcrypt)
- [ ] Code expiration logic

### Integration Tests
- [ ] New user flow: register → login → setup → recovery codes
- [ ] Existing user: access settings → generate codes
- [ ] Recovery code usage: reset master password
- [ ] Code burning: one-time use only
- [ ] Code revocation: burn all codes

### E2E Tests (if using Cypress/Playwright)
- [ ] Full new user onboarding with recovery codes
- [ ] Settings page recovery code management
- [ ] Recovery code download/print
- [ ] Master password reset with recovery code

### Security Tests
- [ ] Code brute-force resistance (rate limiting)
- [ ] Code hashing (verify bcrypt used)
- [ ] One-time use enforcement
- [ ] Expiration enforcement
- [ ] Login password required (can't bypass with just code)

---

## Phase 7: Documentation

### User Documentation
- [ ] Guide: "How to Generate & Store Recovery Codes"
- [ ] FAQ: "What if I lose my recovery codes?"
- [ ] FAQ: "Can I reset my password without recovery codes?"
- [ ] Guide: "Master Password vs Login Password - What's the difference?"
- [ ] Video: Recovery code generation walkthrough (optional)

### Developer Documentation
- [ ] API endpoint docs (OpenAPI/Swagger)
- [ ] RecoveryCodeService usage guide
- [ ] Database schema diagram
- [ ] Error codes and handling

### SECURITY.md Update
- [ ] Add section: "Master Password Recovery Mechanism"
- [ ] Explain recovery codes approach
- [ ] Threat model (what recovery codes protect against)
- [ ] Expiration & rotation policy
- [ ] Link to user guide

---

## Phase 8: Migration & Rollout

### Pre-Launch
- [ ] Run migration script on staging
- [ ] Run migration script on production
- [ ] Verify all tables created correctly
- [ ] Zero downtime? (API should still work without feature flag)

### Launch with Feature Flag OFF
- [ ] Deploy code with flag disabled
- [ ] Verify API endpoints return 404 when disabled
- [ ] Verify modals not shown
- [ ] Monitor error logs
- [ ] Test with dogfooding (internal users)

### Gradual Rollout
- [ ] Day 1: Enable flag for 10% of new users
- [ ] Monitor: errors, usage, user feedback
- [ ] Day 2: Enable for 50% of new users
- [ ] Day 4: Enable for 100% of new users

### Full Launch
- [ ] Remove feature flag
- [ ] Show warning banner to existing users
- [ ] Monitor adoption
- [ ] Respond to user feedback
- [ ] Update public changelog

---

## Phase 9: Monitoring & Maintenance

### Metrics to Track
- [ ] % of new users generating recovery codes
- [ ] % of existing users who opt-in
- [ ] Recovery code generation events per day
- [ ] Recovery code usage per day
- [ ] Code burn rate
- [ ] Brute force attempts (rate limited)

### Alerts to Set Up
- [ ] Unusual recovery code usage patterns
- [ ] High failure rate on recovery code validation
- [ ] Database errors in recovery codes table
- [ ] Expired codes not cleaning up properly

### Scheduled Maintenance
- [ ] Daily: cleanup expired codes (cron job)
- [ ] Weekly: review audit logs
- [ ] Monthly: check adoption metrics
- [ ] Quarterly: security audit of recovery code handling

---

## Phase 10: Deprecation (After 6 months)

### Timeline
- [ ] Month 6: Announce deprecation of login password reset method
- [ ] Month 8: Show warning when using login password reset
- [ ] Month 9: Disable login password reset (only recovery codes allowed)
- [ ] Month 12: Remove login password reset code entirely

### Before Deprecation
- [ ] Ensure adoption reaches >80% of users
- [ ] Create user guides for migration
- [ ] Set up support for questions
- [ ] Monitor for issues in feedback

---

## Rollback Plan

If issues discovered post-launch:

1. **Minor Issues** (e.g., UI bug):
   - Fix immediately, deploy hotfix
   - Feature stays enabled

2. **Critical Issues** (e.g., security vulnerability):
   - Set feature flag to OFF
   - Investigate root cause
   - Deploy fix
   - Re-enable after verification

3. **Database Issues**:
   - Rollback migration
   - Hotfix issue
   - Re-run migration
   - Test thoroughly

---

## Sign-Off Checklist

- [ ] Product/Design review complete
- [ ] Security review complete
- [ ] Performance review complete (no DB slowdowns)
- [ ] Documentation complete
- [ ] All tests passing
- [ ] Staging deployment successful
- [ ] Ready for production rollout

