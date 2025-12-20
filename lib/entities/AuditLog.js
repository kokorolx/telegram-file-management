import { EntitySchema } from "typeorm";

export const AuditLog = new EntitySchema({
    name: "AuditLog",
    tableName: "audit_logs",
    columns: {
        id: {
            primary: true,
            type: "uuid",
            generated: "uuid",
        },
        user_id: {
            type: "text",
            nullable: true,
        },
        action: {
            type: "text",
        },
        resource_type: {
            type: "text",
            nullable: true,
        },
        resource_id: {
            type: "text",
            nullable: true,
        },
        details: {
            type: "jsonb",
            nullable: true,
        },
        ip_address: {
            type: "text",
            nullable: true,
        },
        user_agent: {
            type: "text",
            nullable: true,
        },
        created_at: {
            type: "timestamp",
            createDate: true,
        },
    },
});
