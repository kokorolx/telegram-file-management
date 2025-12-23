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
import { SharedLink } from "./entities/SharedLink.js";
import { AuditLog } from "./entities/AuditLog.js";
import { Organization } from "./entities/Organization.js";
import { RecoveryCode } from "./entities/RecoveryCode.js";

// Import migrations
import { S3BackupStorage1734789600000 } from "./migrations/1734789600000-S3BackupStorage.js";
import { RecoveryCodes1734876000000 } from "./migrations/1734876000000-RecoveryCodes.js";
import { AddEmailToUser1734900000000 } from "./migrations/1734900000000-AddEmailToUser.js";
import { FixEmailNullability1734970000000 } from "./migrations/1734970000000-FixEmailNullability.js";
import { RemoveLegacyUserColumns1734980000000 } from "./migrations/1734980000000-RemoveLegacyUserColumns.js";
import { AddIsFragmentedToFiles1735000000000 } from "./migrations/1735000000000-AddIsFragmentedToFiles.js";
import { AddInitSegmentToFileParts1735020000000 } from "./migrations/1735020000000-AddInitSegmentToFileParts.js";

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
        BotUsageStat,
        SharedLink,
        AuditLog,
        Organization,
        RecoveryCode
    ],
    migrations: [
        S3BackupStorage1734789600000,
        RecoveryCodes1734876000000,
        AddEmailToUser1734900000000,
        FixEmailNullability1734970000000,
        RemoveLegacyUserColumns1734980000000,
        AddIsFragmentedToFiles1735000000000,
        AddInitSegmentToFileParts1735020000000,
    ],
    subscribers: [],
    ssl: getSslConfig(),
});

let initPromise = null;

export async function getDataSource() {
    if (dataSource.isInitialized) return dataSource;

    if (!initPromise) {
        initPromise = dataSource.initialize()
            .then(ds => {
                return ds;
            })
            .catch(err => {
                initPromise = null;
                throw err;
            });
    }

    return initPromise;
}
