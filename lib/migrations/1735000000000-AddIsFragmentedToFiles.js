export class AddIsFragmentedToFiles1735000000000 {
    async up(queryRunner) {
        // Add is_fragmented column to files table
        await queryRunner.query(`
            ALTER TABLE "files"
            ADD COLUMN "is_fragmented" boolean NOT NULL DEFAULT false
        `);

        console.log('✓ Added is_fragmented column to files table');
    }

    async down(queryRunner) {
        // Remove is_fragmented column
        await queryRunner.query(`
            ALTER TABLE "files"
            DROP COLUMN "is_fragmented"
        `);
    }
}
