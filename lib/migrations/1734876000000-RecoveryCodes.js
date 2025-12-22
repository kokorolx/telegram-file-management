/**
 * TypeORM Migration: Recovery Codes Infrastructure
 * Adds recovery codes table and user columns for master password recovery
 * Date: 2025-12-22
 */
export class RecoveryCodes1734876000000 {
    name = 'RecoveryCodes1734876000000';

    async up(queryRunner) {
        // Add recovery code related columns to users table
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recovery_codes_enabled" BOOLEAN DEFAULT FALSE`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recovery_codes_generated_on_first_setup" BOOLEAN DEFAULT FALSE`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_master_password_change" TIMESTAMP`);

        // Create recovery_codes table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "recovery_codes" (
                "id" TEXT PRIMARY KEY,
                "user_id" TEXT NOT NULL,
                "code_hash" TEXT NOT NULL,
                "used" BOOLEAN DEFAULT FALSE,
                "used_at" TIMESTAMP,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "expires_at" TIMESTAMP,
                "burned_reason" TEXT,
                FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);

        // Create indexes for efficient queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recovery_codes_user_id" ON "recovery_codes"("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recovery_codes_user_used" ON "recovery_codes"("user_id", "used")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recovery_codes_expires_at" ON "recovery_codes"("expires_at")`);

        // Index for cleanup queries to find expired codes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recovery_codes_expired" ON "recovery_codes"("user_id", "used", "expires_at") WHERE "used" = FALSE`);
    }

    async down(queryRunner) {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_codes_expired"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_codes_expires_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_codes_user_used"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_codes_user_id"`);

        // Drop recovery_codes table
        await queryRunner.query(`DROP TABLE IF EXISTS "recovery_codes"`);

        // Remove columns from users
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_master_password_change"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "recovery_codes_generated_on_first_setup"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "recovery_codes_enabled"`);
    }
}
