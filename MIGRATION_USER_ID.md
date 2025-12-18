# Migration: user_id Backfill

## What Happened

When updating the database schema to support Passport authentication, the `user_id` column was added to `files` and `folders` tables. If you had existing data, those columns would be NULL and cause constraint violations.

## Migration Script

Created `/scripts/migrate-user-id.js` that automatically:

1. **Checks for existing users** - Uses first existing user for data
2. **Creates default admin user** (if needed) - If no users exist, creates `admin` with password `admin123`
3. **Backfills NULL user_ids** - Assigns all existing files/folders to the admin user
4. **Adds NOT NULL constraints** - Makes user_id required going forward

## How to Run

```bash
npm run migrate
```

This script will:
- Show what it's doing step-by-step
- Backfill any NULL user_ids
- Add NOT NULL constraints
- Report success or errors

## What the Script Does

### If Users Already Exist
```
1. Find first existing user
2. Assign all files/folders to that user
3. Add NOT NULL constraints
```

### If No Users Exist
```
1. Create admin user (ID, username: admin, password: admin123)
2. Assign all files/folders to admin user
3. Add NOT NULL constraints
4. Display credentials for first login
```

## Example Output

```
Starting user_id migration...

1. Checking existing users...
   Found 3 existing users

2. Using first existing user for migration...
   ✓ Using user ID: ebeb6809-09c4-4099-87d1-a0238c805d60

3. Checking files with NULL user_id...
   Found 0 files without user_id

4. Checking folders with NULL user_id...
   Found 0 folders without user_id

5. Ensuring NOT NULL constraints...
   ✓ Added NOT NULL constraint to files.user_id
   ✓ Added NOT NULL constraint to folders.user_id

✅ Migration complete!
```

## Troubleshooting

### "Cannot add NOT NULL: Still have NULL values"
Some files or folders still have NULL user_ids. This means:
1. The backfill didn't work (check database)
2. Or files were added after the migration started

**Solution:**
```sql
-- Manually backfill
UPDATE files SET user_id = 'your-user-id' WHERE user_id IS NULL;
UPDATE folders SET user_id = 'your-user-id' WHERE user_id IS NULL;

-- Then run migration again
npm run migrate
```

### "ERROR: relation 'users' does not exist"
Database hasn't been initialized. Run:
```bash
npm run setup-db
npm run migrate
```

### "ERROR: column 'user_id' does not exist"
The column hasn't been created yet. This shouldn't happen with new installs. If you see this:
```bash
npm run setup-db  # Re-create schema
npm run migrate   # Then migrate data
```

## Database Changes

### Before Migration
```sql
files:
  id TEXT PRIMARY KEY
  folder_id TEXT
  original_filename TEXT
  ... (other fields)

folders:
  id TEXT PRIMARY KEY
  name TEXT
  ... (other fields)
```

### After Migration
```sql
files:
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL      -- NEW, required
  folder_id TEXT
  original_filename TEXT
  ... (other fields)

folders:
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL      -- NEW, required
  name TEXT
  ... (other fields)
```

## Data Isolation After Migration

Once migration is complete:

**All files/folders belong to their assigned user_id**

```
User A: Can only see files where user_id = 'user-a-id'
User B: Can only see files where user_id = 'user-b-id'
```

When a new user registers and uploads files:
```javascript
// Files are automatically tagged with their user_id
const fileData = {
  user_id: currentUser.id,  // Automatically set
  ... other fields
};
```

## If You Changed User IDs

If you want to reassign files/folders to a different user:

```sql
-- Move all files from user1 to user2
UPDATE files 
SET user_id = 'user2-id' 
WHERE user_id = 'user1-id';

-- Move all folders from user1 to user2
UPDATE folders 
SET user_id = 'user2-id' 
WHERE user_id = 'user1-id';
```

## Admin User

If the migration created an admin user:

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**⚠️ Important:** Change the password immediately after first login.

To change password:
1. Login with admin credentials
2. Go to settings/profile
3. Change password (if password change feature exists)

Or via database (if needed):
```sql
-- Hash password with bcrypt first
UPDATE users 
SET password_hash = '$2a$10$...' 
WHERE username = 'admin';
```

## Deployment

### Local Development
```bash
npm install
npm run setup-db
npm run migrate
npm run dev
```

### Staging/Production
```bash
npm install
npm run setup-db      # Create schema
npm run migrate       # Backfill data
npm start             # Start app
```

## After Migration

Everything should work normally:
- Users can login
- Files are isolated by user_id
- Folders are isolated by user_id
- API endpoints filter by user_id
- No more NULL user_id errors

## Files Modified

- `/scripts/migrate-user-id.js` - New migration script
- `/package.json` - Added `migrate` npm script
- `/lib/db.js` - Made user_id nullable in schema (to allow migration)

## Next Steps

1. Run migration: `npm run migrate`
2. Test login: `npm run dev`
3. Verify files are only visible to their user
4. Start using the app with Passport authentication

## Questions?

See other documentation:
- `PASSPORT_AUTHENTICATION.md` - Authentication details
- `PASSPORT_QUICK_START.md` - Quick reference
- `PASSPORT_IMPLEMENTATION_NEXT_STEPS.md` - Remaining work
