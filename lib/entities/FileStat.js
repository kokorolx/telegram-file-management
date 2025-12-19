import { EntitySchema } from "typeorm";

export const FileStat = new EntitySchema({
    name: "FileStat",
    tableName: "file_stats",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        file_id: {
            type: "text",
            unique: true,
        },
        user_id: {
            type: "text",
        },
        download_count: {
            type: "integer",
            default: 0,
        },
        view_count: {
            type: "integer",
            default: 0,
        },
        last_downloaded_at: {
            type: "timestamp",
            nullable: true,
        },
        last_viewed_at: {
            type: "timestamp",
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
            type: "one-to-one",
            joinColumn: { name: "file_id" },
            onDelete: "CASCADE",
        },
        user: {
            target: "User",
            type: "many-to-one",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
    },
});
