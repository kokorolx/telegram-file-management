import { EntitySchema } from "typeorm";

export const BotUsageStat = new EntitySchema({
    name: "BotUsageStat",
    tableName: "bot_usage_stats",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        bot_id: {
            type: "text",
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
        uploads_count: {
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
        bot: {
            target: "UserBot",
            type: "many-to-one",
            joinColumn: { name: "bot_id" },
            onDelete: "CASCADE",
        },
        user: {
            target: "User",
            type: "many-to-one",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
    },
    uniques: [
      {
        name: "unique_bot_user",
        columns: ["bot_id", "user_id"],
      }
    ]
});
