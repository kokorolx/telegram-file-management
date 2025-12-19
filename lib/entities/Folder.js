import { EntitySchema } from "typeorm";

export const Folder = new EntitySchema({
    name: "Folder",
    tableName: "folders",
    columns: {
        id: {
            primary: true,
            type: "text",
        },
        user_id: {
            type: "text",
            nullable: true,
        },
        name: {
            type: "text",
        },
        slug: {
            type: "text",
            nullable: true,
        },
        parent_id: {
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
    relations: {
        user: {
            target: "User",
            type: "many-to-one",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
        parent: {
            target: "Folder",
            type: "many-to-one",
            joinColumn: { name: "parent_id" },
            onDelete: "CASCADE",
        },
        children: {
            target: "Folder",
            type: "one-to-many",
            inverseSide: "parent",
        },
        files: {
            target: "File",
            type: "one-to-many",
            inverseSide: "folder",
        },
    },
});
