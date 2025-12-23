/**
 * TypeORM Migration: Fix Email Nullability
 * Converts existing empty email strings to NULL to allow multiple users without emails
 * Date: 2025-12-23
 */
export class FixEmailNullability1734970000000 {
    name = 'FixEmailNullability1734970000000';

    async up(queryRunner) {
        // 1. Convert all empty strings to NULL to avoid unique constraint violations
        // Standard SQL: NULL is distinct, '' is a value.
        await queryRunner.query(`UPDATE "users" SET "email" = NULL WHERE "email" = ''`);

        // 2. Ensure index is partial and covers NULLs correctly
        // We drop and recreate it to be absolutely sure it's the partial version
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users"("email") WHERE "email" IS NOT NULL`);
    }

    async down(queryRunner) {
        // We don't want to revert NULLs back to empty strings usually,
        // but for a strict rollback:
        // No-op or keep as NULL is safer.

        // Re-ensure the index exists
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users"("email")`);
    }
}
