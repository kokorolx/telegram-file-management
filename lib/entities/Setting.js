import { EntitySchema } from "typeorm";

export const Setting = new EntitySchema({
    name: "Setting",
    tableName: "settings",
    columns: {
        id: {
            primary: true,
            type: "integer",
            default: 1,
        },
        telegram_bot_token: {
            type: "text",
        },
        telegram_user_id: {
            type: "text",
        },
        master_password_hash: {
            type: "text",
            nullable: true,
        },
        setup_complete: {
            type: "boolean",
            default: false,
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
