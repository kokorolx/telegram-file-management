import { EntitySchema } from "typeorm";

export const FilePart = new EntitySchema({
    name: "FilePart",
    tableName: "file_parts",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        file_id: {
            type: "text",
        },
        telegram_file_id: {
            type: "text",
        },
        part_number: {
            type: "integer",
        },
        size: {
            type: "bigint",
        },
        iv: {
            type: "text",
            nullable: true,
        },
        auth_tag: {
            type: "text",
            nullable: true,
        },
        bot_id: {
            type: "text",
            nullable: true,
        },
        is_compressed: {
            type: "boolean",
            default: false,
        },
        is_init_segment: {
            type: "boolean",
            default: false,
            comment: "For fragmented videos: true if this is the init segment (ftyp+moov) that must be appended first"
        },
        backup_storage_id: {
            type: "text",
            nullable: true,
        },
        backup_backend: {
            type: "text",
            nullable: true,
        },
        created_at: {
            type: "timestamp",
            createDate: true,
        },
        updated_at: {
            type: "timestamp",
            updateDate: true,
        },
    },
    relations: {
        file: {
            target: "File",
            type: "many-to-one",
            joinColumn: { name: "file_id" },
            onDelete: "CASCADE",
        },
    },
});
