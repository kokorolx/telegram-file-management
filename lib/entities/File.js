import { EntitySchema } from "typeorm";

export const File = new EntitySchema({
    name: "File",
    tableName: "files",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        user_id: {
            type: "text",
            nullable: true,
        },
        folder_id: {
            type: "text",
            nullable: true,
        },
        telegram_file_id: {
            type: "text",
            nullable: true,
        },
        original_filename: {
            type: "text",
        },
        file_size: {
            type: "bigint",
        },
        file_type: {
            type: "text",
            nullable: true,
        },
        mime_type: {
            type: "text",
            nullable: true,
        },
        uploaded_at: {
            type: "timestamp",
            createDate: true,
        },
        updated_at: {
            type: "timestamp",
            updateDate: true,
        },
        description: {
            type: "text",
            nullable: true,
        },
        tags: {
            type: "text",
            nullable: true,
        },
        is_encrypted: {
            type: "boolean",
            default: false,
        },
        encryption_algo: {
            type: "text",
            nullable: true,
        },
        encrypted_file_key: {
            type: "text",
            nullable: true,
        },
        key_iv: {
            type: "text",
            nullable: true,
        },
        encryption_version: {
             type: "int",
             default: 1, // 1 = Direct, 2 = Envelope
         },
         is_complete: {
             type: "boolean",
             default: false,
         },
         total_parts_expected: {
             type: "int",
             default: 0,
         },
         chunk_sizes: {
             type: "simple-json",
             nullable: true, // Array of chunk sizes
         },
         is_fragmented: {
             type: "boolean",
             default: false, // True if MP4 was fragmented for progressive playback
         },
         video_duration: {
             type: "integer",
             nullable: true, // Duration in seconds (for videos), null for non-videos
         },
         },
    relations: {
        user: {
            target: "User",
            type: "many-to-one",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
        folder: {
            target: "Folder",
            type: "many-to-one",
            joinColumn: { name: "folder_id" },
            onDelete: "SET NULL",
        },
        parts: {
            target: "FilePart",
            type: "one-to-many",
            inverseSide: "file",
        },
    },
});
