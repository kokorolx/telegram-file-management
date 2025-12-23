export class AddInitSegmentToFileParts1735020000000 {
    async up(queryRunner) {
        // Add is_init_segment column to file_parts table
        // For fragmented videos: the first chunk (containing ftyp+moov) is marked as the init segment
        // This must be appended to SourceBuffer first, before any media segments
        await queryRunner.query(`
            ALTER TABLE "file_parts"
            ADD COLUMN "is_init_segment" boolean NOT NULL DEFAULT false
        `);

        // Create index for efficient filtering of init segments
        await queryRunner.query(`
            CREATE INDEX "idx_file_parts_init_segment" ON "file_parts" ("file_id", "is_init_segment")
        `);

        console.log('✓ Added is_init_segment column to file_parts table');
    }

    async down(queryRunner) {
        // Drop index first
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_file_parts_init_segment"
        `);

        // Remove is_init_segment column
        await queryRunner.query(`
            ALTER TABLE "file_parts"
            DROP COLUMN "is_init_segment"
        `);
    }
}
