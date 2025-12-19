import { EntitySchema } from "typeorm";

export const UserStat = new EntitySchema({
    name: "UserStat",
    tableName: "user_stats",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        user_id: {
            type: "text",
            unique: true,
        },
        total_files: {
            type: "integer",
            default: 0,
        },
        total_size: {
            type: "bigint",
            default: 0,
        },
        total_uploads: {
            type: "integer",
            default: 0,
        },
        total_downloads: {
            type: "integer",
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
        user: {
            target: "User",
            type: "one-to-one",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
    },
});
