import { EntitySchema } from "typeorm";

export const Organization = new EntitySchema({
    name: "Organization",
    tableName: "organizations",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        name: {
            type: "text",
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
