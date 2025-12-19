import { EntitySchema } from "typeorm";

export const UserBot = new EntitySchema({
    name: "UserBot",
    tableName: "user_bots",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        user_id: {
            type: "text",
        },
        name: {
            type: "text",
            nullable: true,
        },
        bot_token: {
            type: "text",
        },
        tg_user_id: {
            type: "text",
        },
        is_default: {
            type: "boolean",
            default: false,
        },
        upload_counter: {
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
            type: "many-to-one",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
    },
});
