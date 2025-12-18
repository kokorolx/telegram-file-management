# Quick Reference: Database Migration

## TL;DR

```bash
npm run migrate    # Fixes null user_id errors
```

Done. That's it.

## What It Does

Automatically:
1. Backfills NULL user_ids in files & folders
2. Adds NOT NULL constraints
3. Creates admin user if needed

## Output

```
✅ Migration complete!
```

## One-Time Setup

```bash
npm install
npm run setup-db
npm run migrate
npm run dev
```

## Troubleshooting

### Still getting null value errors?
```bash
npm run migrate
```

### Migration failed?
Check database is accessible:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

## That's All

The migration is idempotent (safe to run multiple times).

No more user_id constraint errors.

Proceed with Passport authentication testing.

---

See `MIGRATION_USER_ID.md` for detailed docs.
