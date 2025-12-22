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
        email: {
            type: "text",
            nullable: true,
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
        organization_id: {
            type: "text",
            nullable: true,
        },
        encrypted_s3_config: {
            type: "text",
            nullable: true,
        },
        s3_config_iv: {
            type: "text",
            nullable: true,
        },
        s3_config_tag: {
            type: "text",
            nullable: true,
        },
        recovery_codes_enabled: {
            type: "boolean",
            default: false,
            nullable: true,
        },
        recovery_codes_generated_on_first_setup: {
            type: "boolean",
            default: false,
            nullable: true,
        },
        last_master_password_change: {
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
});
