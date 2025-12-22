/**
 * TypeORM Migration: S3 Backup Storage Support
 * Adds columns for S3/R2 backup storage configuration
 */
export class S3BackupStorage1734789600000 {
    name = 'S3BackupStorage1734789600000';

    async up(queryRunner) {
        // Add S3 backup columns to users table
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" TEXT`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "encrypted_s3_config" TEXT`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "s3_config_iv" TEXT`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "s3_config_tag" TEXT`);

        // Add backup columns to file_parts table
        await queryRunner.query(`ALTER TABLE "file_parts" ADD COLUMN IF NOT EXISTS "backup_storage_id" TEXT`);
        await queryRunner.query(`ALTER TABLE "file_parts" ADD COLUMN IF NOT EXISTS "backup_backend" TEXT`);

        // Create organizations table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "organizations" (
                "id" TEXT PRIMARY KEY,
                "name" TEXT NOT NULL,
                "encrypted_s3_config" TEXT,
                "s3_config_iv" TEXT,
                "s3_config_tag" TEXT,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create index for organization lookup
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_organization_id" ON "users"("organization_id")`);
    }

    async down(queryRunner) {
        // Drop index
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_organization_id"`);

        // Drop organizations table
        await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);

        // Remove columns from file_parts
        await queryRunner.query(`ALTER TABLE "file_parts" DROP COLUMN IF EXISTS "backup_backend"`);
        await queryRunner.query(`ALTER TABLE "file_parts" DROP COLUMN IF EXISTS "backup_storage_id"`);

        // Remove columns from users
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "s3_config_tag"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "s3_config_iv"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "encrypted_s3_config"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_id"`);
    }
}
