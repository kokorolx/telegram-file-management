/**
 * TypeORM Migration: Remove Legacy User Columns
 * Drops tg_bot_token and tg_user_id columns from users table
 * Date: 2025-12-23
 */
export class RemoveLegacyUserColumns1734980000000 {
    name = 'RemoveLegacyUserColumns1734980000000';

    async up(queryRunner) {
        // Drop legacy columns from users table
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "tg_bot_token"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "tg_user_id"`);
    }

    async down(queryRunner) {
        // Re-add legacy columns as optional
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tg_bot_token" TEXT`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tg_user_id" TEXT`);
    }
}
