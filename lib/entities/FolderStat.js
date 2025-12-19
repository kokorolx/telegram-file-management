import { EntitySchema } from "typeorm";

export const FolderStat = new EntitySchema({
    name: "FolderStat",
    tableName: "folder_stats",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        folder_id: {
            type: "text",
            unique: true,
        },
        user_id: {
            type: "text",
        },
        files_count: {
            type: "integer",
            default: 0,
        },
        total_size: {
            type: "bigint",
            default: 0,
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
        folder: {
            target: "Folder",
            type: "one-to-one",
            joinColumn: { name: "folder_id" },
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
