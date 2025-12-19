import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from 'dotenv';
import { User } from "./entities/User.js";
import { Folder } from "./entities/Folder.js";
import { File } from "./entities/File.js";
import { FilePart } from "./entities/FilePart.js";
import { UserBot } from "./entities/UserBot.js";
import { Setting } from "./entities/Setting.js";
import { UserStat } from "./entities/UserStat.js";
import { FolderStat } from "./entities/FolderStat.js";
import { FileStat } from "./entities/FileStat.js";
import { BotUsageStat } from "./entities/BotUsageStat.js";

dotenv.config({ path: '.env.local' });

const getSslConfig = () => {
    if (process.env.DATABASE_URL?.includes('localhost')) {
        return false;
    }
    return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
};

export const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    synchronize: false, // Set to false to avoid accidental schema changes in production
    logging: process.env.NODE_ENV !== 'production',
    entities: [
        User,
        Folder,
        File,
        FilePart,
        UserBot,
        Setting,
        UserStat,
        FolderStat,
        FileStat,
        BotUsageStat
    ],
    migrations: [],
    subscribers: [],
    ssl: getSslConfig(),
});

let initialized = false;

export async function getDataSource() {
    if (!initialized) {
        await dataSource.initialize();
        initialized = true;
    }
    return dataSource;
}
