import { EntitySchema } from "typeorm";

export const SharedLink = new EntitySchema({
    name: "SharedLink",
    tableName: "shared_links",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        file_id: {
            type: "text",
        },
        user_id: {
            type: "text",
        },
        token: {
            type: "text",
            unique: true,
        },
        wrapped_file_key: {
            type: "text",
            nullable: true,
        },
        key_iv: {
            type: "text",
            nullable: true,
        },
        is_password_protected: {
            type: "boolean",
            default: false,
        },
        password_hash: {
            type: "text",
            nullable: true,
        },
        expires_at: {
            type: "timestamp",
            nullable: true,
        },
        views: {
            type: "int",
            default: 0,
        },
        downloads: {
            type: "int",
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
        file: {
            target: "File",
            type: "many-to-one",
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
