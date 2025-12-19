import { EntitySchema } from "typeorm";

export const User = new EntitySchema({
    name: "User",
    tableName: "users",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        username: {
            type: "text",
            unique: true,
        },
        password_hash: {
            type: "text",
        },
        master_password_hash: {
            type: "text",
            nullable: true,
        },
        encryption_salt: {
            type: "text",
            nullable: true,
        },
        tg_bot_token: {
            type: "text",
            nullable: true,
        },
        tg_user_id: {
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
});
