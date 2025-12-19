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
