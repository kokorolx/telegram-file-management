/**
 * TypeORM Migration: Add Email Column to User
 * Adds optional email column for password reset functionality
 * Date: 2025-12-23
 */
export class AddEmailToUser1734900000000 {
    name = 'AddEmailToUser1734900000000';

    async up(queryRunner) {
        // Add email column to users table
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT`);

        // Add unique constraint
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email") WHERE "email" IS NOT NULL`);
    }

    async down(queryRunner) {
        // Drop index
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email"`);

        // Drop email column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`);
    }
}
