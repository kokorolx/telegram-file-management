export class AddVideoDurationToFiles1735021000000 {
    async up(queryRunner) {
        // Add video_duration column to files table
        // Stores duration in seconds for videos (null for non-videos)
        await queryRunner.query(`
            ALTER TABLE "files"
            ADD COLUMN "video_duration" integer
        `);

        console.log('✓ Added video_duration column to files table');
    }

    async down(queryRunner) {
        // Remove video_duration column
        await queryRunner.query(`
            ALTER TABLE "files"
            DROP COLUMN "video_duration"
        `);
    }
}
