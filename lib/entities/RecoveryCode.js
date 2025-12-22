import { EntitySchema } from "typeorm";

export const RecoveryCode = new EntitySchema({
    name: "RecoveryCode",
    tableName: "recovery_codes",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        user_id: {
            type: "text",
        },
        code_hash: {
            type: "text",
        },
        used: {
            type: "boolean",
            default: false,
        },
        used_at: {
            type: "timestamp",
            nullable: true,
        },
        created_at: {
            type: "timestamp",
            createDate: true,
        },
        expires_at: {
            type: "timestamp",
            nullable: true,
        },
        burned_reason: {
            type: "text",
            nullable: true,
        },
    },
    relations: {
        user: {
            type: "many-to-one",
            target: "User",
            joinColumn: {
                name: "user_id",
            },
        },
    },
});
