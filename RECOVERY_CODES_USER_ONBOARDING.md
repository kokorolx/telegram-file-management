# Recovery Codes - User Onboarding Strategy

## Overview

This document details how we ensure users are aware of and set up recovery codes after account creation.

---

## For NEW Users (Mandatory Flow After Setup)

### User Journey Map

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER PERSPECTIVE                                                     │
├─────────────────────────────────────────────────────────────────────┤

Step 1: Sign Up
└─→ User creates account with username + password
    └─→ Redirected to login page
    
Step 2: Login
└─→ User logs in
    └─→ SetupModal shows (create master password)
    
Step 3: Create Master Password
└─→ User enters & confirms master password
    └─→ Clicks "Secure Vault"
    └─→ Vault unlocked, files visible
    
Step 4: ⭐ RecoveryCodeModal AUTO-SHOWS ⭐ [NEW]
└─→ Modal title: "🔐 Protect Your Vault"
    └─→ Shows 10 recovery codes
    └─→ Large warning text:
        "These codes are your backup plan.
         Store them safely offline.
         ⚠️ One-time use only - lost codes cannot be recovered!"
         
Step 5: User Actions (pick one)
├─→ Option A: Save Codes + Check Checkbox
│   └─→ User can:
│       • Click [Copy] for each code
│       • Click [Download as .txt]
│       • Click [Print All]
│   └─→ User MUST:
│       • Check checkbox: "I have saved these codes..."
│   └─→ Click "✓ Got it - Access My Vault"
│       └─→ Modal closes
│       └─→ RecoveryCodeService.saveCodes() called
│       └─→ recovery_codes_enabled = TRUE (DB)
│       └─→ recovery_codes_generated_on_first_setup = TRUE (DB)
│       └─→ Codes hashed & stored in recovery_codes table
│       └─→ Plaintext codes deleted from memory
│       └─→ User can now use vault normally
│
└─→ Option B: Skip for Later
    └─→ User clicks "Skip for Now"
    └─→ Modal closes
    └─→ recovery_codes_generated_on_first_setup = FALSE (DB)
    └─→ User can use vault normally
    └─→ ⚠️ Warning banner shows on NEXT LOGIN

┌─────────────────────────────────────────────────────────────────────┐
│ IF USER SKIPS: What Happens Next?                                   │
├─────────────────────────────────────────────────────────────────────┤

1. User logs out (or session expires)

2. User logs back in

3. Dashboard loads + RecoveryCodeWarningBanner appears at top:

   ┌─────────────────────────────────────────────────┐
   │ ⚠️ SECURITY ALERT                               │
   ├─────────────────────────────────────────────────┤
   │ Your vault has no recovery codes!               │
   │ If you forget your master password, all files   │
   │ will be lost permanently.                       │
   │                                                 │
   │ [Generate Recovery Codes Now] [Dismiss]         │
   └─────────────────────────────────────────────────┘

4. User can:
   a) Click "Generate Recovery Codes Now"
      └─→ RecoveryCodeModal shows again
      └─→ Complete the setup
   
   b) Click "Dismiss"
      └─→ Banner hidden for this session
      └─→ Banner shows again on next login (until codes generated)

5. Settings panel also shows reminder badge:
   └─→ "Recovery & Security"
   └─→ Badge with number "0 codes"
   └─→ Button: "Generate Codes Now"

┌─────────────────────────────────────────────────────────────────────┐
│ AFTER 7 DAYS OF SKIPPING                                            │
├─────────────────────────────────────────────────────────────────────┤

1. If user still hasn't generated codes:

2. Banner becomes more prominent:
   └─→ Red background instead of yellow
   └─→ "Your vault is at risk!" message
   └─→ Still not blocking (user can still use app)

3. Optional: Modal reminder on login
   └─→ Gentle modal (not blocking)
   └─→ "Protect your vault - generate recovery codes now?"
   └─→ [Generate] [Maybe Later] buttons

┌─────────────────────────────────────────────────────────────────────┐
│ AFTER 30 DAYS OF SKIPPING                                           │
├─────────────────────────────────────────────────────────────────────┤

1. Notification in settings (if they visit)
2. Email notification (optional, if email system exists)
3. Still not blocking - user can use app normally
```

---

## For EXISTING Users (Soft Migration)

### Timeline & Strategy

#### Week 1: Announcement
- [ ] Add blog post: "Introducing Recovery Codes"
- [ ] Email to existing users (optional): "Protect your vault with recovery codes"
- [ ] In-app banner in Settings: "New: Recovery Codes Security Feature"

#### Week 2: Enable Settings
- [ ] Settings page updated with new "Recovery & Security" section
- [ ] Status: "Not enabled yet"
- [ ] Button: "Generate Recovery Codes Now"
- [ ] Description: Explains what codes are, why important
- [ ] Link to help docs

#### Week 3+: Smart Reminders
- [ ] Banner: "Protect your data - generate recovery codes"
- [ ] Dismissible initially
- [ ] Reappears after 7 days if not generated
- [ ] Becomes more prominent after 30 days

#### Month 6: Soft Deprecation
- [ ] Show warning on login password reset: "Recovery codes are now recommended"
- [ ] Highlight recovery code method as preferred
- [ ] Provide timeline for deprecating login password method

---

## RecoveryCodeModal Component - UI Specs

### Modal Structure

```
╔════════════════════════════════════════════════════════════════════╗
║                    🔐 PROTECT YOUR VAULT                          ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Your recovery codes are your backup plan to reset your master    ║
║  password if you ever need to.                                    ║
║                                                                    ║
║  Store them safely offline (written down, printed, file, etc).    ║
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ ⚠️ IMPORTANT                                                 │ ║
║  ├──────────────────────────────────────────────────────────────┤ ║
║  │ • Each code is ONE-TIME USE ONLY                            │ ║
║  │ • After using a code, it will be burned and unusable        │ ║
║  │ • Lost codes cannot be recovered - save them safely!        │ ║
║  │ • You can generate new codes anytime from Settings          │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║  ── Your 10 Recovery Codes ─────────────────────────────────────  ║
║                                                                    ║
║  1. ABCD-EFGH-IJKL-MNOP  [Copy]  [← Click to copy]              ║
║  2. PQRS-TUVW-XYZA-BCDE  [Copy]                                 ║
║  3. FGHI-JKLM-NOPQ-RSTU  [Copy]                                 ║
║  4. VWXY-ZABC-DEFG-HIJK  [Copy]                                 ║
║  5. LMNO-PQRS-TUVW-XYZA  [Copy]                                 ║
║  6. BCDE-FGHI-JKLM-NOPQ  [Copy]                                 ║
║  7. RSTU-VWXY-ZABC-DEFG  [Copy]                                 ║
║  8. HIJK-LMNO-PQRS-TUVW  [Copy]                                 ║
║  9. XYZA-BCDE-FGHI-JKLM  [Copy]                                 ║
║  10. NOPQ-RSTU-VWXY-ZABC [Copy]                                 ║
║                                                                    ║
║  ─────────────────────────────────────────────────────────────────║
║  [Download as Text File]  [Print]                                ║
║  ─────────────────────────────────────────────────────────────────║
║                                                                    ║
║  ☐ I have saved/written/printed these codes in a secure          ║
║    location where only I can access them.                        ║
║                                                                    ║
║  [Disabled until checkbox checked:]                              ║
║  [✓ Got it - Access My Vault]   [Skip for Now]                  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Copy Functionality
- Click [Copy] → code copied to clipboard
- Toast notification: "Code copied to clipboard"
- Button changes to [✓ Copied] for 2 seconds

### Download
- Filename: `recovery_codes_YYYY-MM-DD.txt`
- Format:
  ```
  TELEGRAM FILE MANAGER - RECOVERY CODES
  Generated: 2024-12-21
  ⚠️ Keep these safe! Each code is one-time use only.
  
  1. ABCD-EFGH-IJKL-MNOP
  2. PQRS-TUVW-XYZA-BCDE
  ... (8 more)
  
  Lost codes cannot be recovered. Generate new ones from Settings.
  ```

### Print
- Print-friendly format
- Includes warning text
- 10 codes per page
- User can save as PDF

### Checkbox Logic
- Initially unchecked
- User MUST check before "Got it" button enabled
- Tooltip if they try to click disabled button: "Please confirm you've saved the codes"

### Button States
- "Skip for Now": Always enabled (allows user to skip)
- "Got it": Disabled until checkbox checked

---

## RecoveryCodeWarningBanner Component

### First Appearance

**Location**: Top of dashboard (under header, above file list)

**For NEW users who skipped**:
- Shows on next login
- Yellow/orange background (not red - not an error)
- Can be dismissed
- Reappears on next login if not generated

**For EXISTING users**:
- Shows after 7 days of feature being live if they haven't generated codes
- Yellow/orange initially
- Becomes more prominent (red/bold) after 30 days

### UI

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ No recovery codes yet!                                       │
│                                                                 │
│ Generate them now to protect your vault from permanent data    │
│ loss if you forget your master password.                       │
│                                                                 │
│                      [Generate Now] [Dismiss]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Behavior
- "Generate Now": Opens RecoveryCodeModal
- "Dismiss": Hides banner for current session
- Banner reappears on next login/refresh (until codes actually generated)

---

## RecoveryCodeSettings Component

### Location
Settings Panel → New section "Recovery & Security"

### Display When Codes NOT Generated
```
┌──────────────────────────────────────────────────────────────┐
│ Recovery & Security                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Status: ❌ No recovery codes                               │
│                                                              │
│ Recovery codes protect your vault if you need to reset your │
│ master password. Generate them now and store safely.        │
│                                                              │
│ [Generate Recovery Codes]                                   │
│                                                              │
│ Need help? [Learn More →]                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Display When Codes GENERATED
```
┌──────────────────────────────────────────────────────────────┐
│ Recovery & Security                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Status: ✅ Recovery codes enabled                          │
│                                                              │
│ Generated: December 21, 2024 at 5:30 PM                    │
│ Expires: December 21, 2025                                 │
│ Remaining: 9 codes (1 used)                                │
│                                                              │
│ Your Codes:                                                 │
│ • XXXX-****-****-MNOP (unused)                             │
│ • XXXX-****-****-BCDE (unused)                             │
│ • ... (8 more)                                              │
│ • XXXX-****-****-ZABC (used on Dec 21, 2024)              │
│                                                              │
│ [Generate New Codes]  [Revoke All]                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Buttons
- "Generate New Codes": Revokes old codes, generates 10 new ones, shows modal
- "Revoke All": Asks for confirmation, burns all unused codes

---

## Database Flags & Logic

### For Tracking User Progress

```javascript
// When to show RecoveryCodeModal to NEW users:
const shouldShowRecoveryModal = (user) => {
  // Only show if:
  // 1. User just created account (recovery_codes_generated_on_first_setup = NULL/FALSE)
  // 2. AND user just completed setup (SetupModal finished)
  // 3. AND recovery_codes_enabled = FALSE
  
  return (
    !user.recovery_codes_generated_on_first_setup &&
    !user.recovery_codes_enabled &&
    setupJustCompleted
  );
};

// When user clicks "Got it" on recovery modal:
await userRepository.setRecoveryCodesGenerated(userId, true);
// Sets both:
// - recovery_codes_enabled = TRUE
// - recovery_codes_generated_on_first_setup = TRUE

// When user clicks "Skip for Now":
// - recovery_codes_enabled stays FALSE
// - recovery_codes_generated_on_first_setup stays FALSE
// - Warning banner will show on next login

// When to show warning banner:
const shouldShowWarningBanner = (user) => {
  return !user.recovery_codes_enabled;
};

// When banner should become more prominent:
const daysSinceCreated = Date.now() - user.created_at;
const shouldBeProminent = daysSinceCreated > 7 * 24 * 60 * 60 * 1000; // 7 days
```

---

## Testing Strategy

### New User Flow
- [ ] Register new account
- [ ] Login
- [ ] SetupModal appears
- [ ] Enter master password
- [ ] Click "Secure Vault"
- [ ] **RecoveryCodeModal appears automatically** ✓
- [ ] Copy a code (verify clipboard works)
- [ ] Download codes (verify file downloads)
- [ ] Try to click "Got it" without checking box (button disabled) ✓
- [ ] Check box
- [ ] Click "Got it"
- [ ] Modal closes, user in vault ✓
- [ ] Verify in DB: recovery_codes_enabled = TRUE ✓
- [ ] Verify in DB: recovery_codes_generated_on_first_setup = TRUE ✓
- [ ] Verify codes hashed in recovery_codes table ✓

### Existing User Flow
- [ ] Existing user (created before feature)
- [ ] Login
- [ ] Settings page loads
- [ ] "Recovery & Security" section visible ✓
- [ ] Status shows "No recovery codes" ✓
- [ ] Click "Generate Now"
- [ ] Prompted for login password
- [ ] RecoveryCodeModal shows
- [ ] Complete flow same as new user ✓

### Skip Flow
- [ ] New user completes setup
- [ ] RecoveryCodeModal appears
- [ ] Click "Skip for Now"
- [ ] Modal closes ✓
- [ ] recovery_codes_enabled = FALSE in DB ✓
- [ ] recovery_codes_generated_on_first_setup = FALSE in DB ✓
- [ ] Logout / Login again
- [ ] Warning banner appears ✓
- [ ] Click "Generate Now"
- [ ] RecoveryCodeModal shows again ✓

---

## Messaging Guidelines

### For New Users
**Tone**: Friendly but serious about importance

Example: "Recovery codes are your insurance policy for your vault. If you ever forget your master password, you'll need these codes to regain access. Store them safely offline—we recommend writing them down or printing them."

### For Existing Users
**Tone**: Helpful, not pushy

Example: "We've added recovery codes as a better way to protect your vault. If you're interested in setting them up, visit Settings → Recovery & Security."

### For Marketing/Changelog
**Tone**: Feature announcement

Example: "New: Recovery Codes for Enhanced Security — Protect your vault with industry-standard recovery codes. Generate them once, store safely, use if you ever need to reset your master password."

