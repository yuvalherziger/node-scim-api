import { Collection, type CreateIndexesOptions, type IndexSpecification, MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { promises as fs } from "fs";
import { client } from "../../common/db.js";
import { logger } from "../../common/logger.js";
import { pathToFileURL } from "url";

const BASE_PATH: string = "dist/migrations/"; // Look for compiled migration files inside the Docker image
const resolvedPath: string = path.join(process.cwd(), BASE_PATH);

type MigrationDoc = {
  _id: ObjectId;
  appliedAt: Date;
};

dotenv.config();

export interface IMigration {
  up(client: MongoClient): Promise<void>;

  dataUp(client: MongoClient): Promise<void>;

  down(client: MongoClient): Promise<void>;

  dataDown(client: MongoClient): Promise<void>;
}

type IndexConfig = {
  rolling: boolean,
  db: string,
  collection: string,
  keys: IndexSpecification | IndexSpecification[],
  options?: CreateIndexesOptions
}

export class Index {
  constructor(private config: IndexConfig) {
  }

  async build(mongoClient: MongoClient): Promise<void> {
    if (this.config.rolling) {
      await this.rollingBuild();
    } else {
      await this.nativeBuild(mongoClient);
    }
  }

  async nativeBuild(mongoClient: MongoClient): Promise<string> {
    const collection: Collection = mongoClient.db(this.config.db).collection(this.config.collection);
    const indexName: string = await collection.createIndex(
      Array.isArray(this.config.keys) ? this.config.keys[0] : this.config.keys,
      this.config.options
    );
    logger.info(`Index '${indexName}' created`);
    return indexName;
  }

  async rollingBuild(): Promise<string | void> {
    throw new Error("Not implemented");
  }
}

type MigrationFile = {
  id: string,
  fileName: string,
  ts: string
};

async function getMigrationFiles(): Promise<MigrationFile[]> {
  const files: string[] = await fs.readdir(resolvedPath);
  const relevantFiles = files.filter(
    (filename: string) => filename.match(/^m-.*\.js$/)
  );
  return relevantFiles.map((fileName: string): MigrationFile => ({
    fileName,
    ts: fileName?.split("-")[1] || "",
    id: (fileName?.split("-")[2] || "").replace(/\.js$/, "")
  })).sort((x, y) => x.ts < y.ts ? -1 : (x.ts > y.ts ? 1 : 0));
}

async function migrate(): Promise<void> {
  await client.connect();
  const migrationColl: Collection<MigrationDoc> = client.db("scim").collection("migrations");
  const cursor = migrationColl.find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1);
  const res = await cursor.toArray();
  const allMigrationFiles: MigrationFile[] = await getMigrationFiles();
  logger.info(allMigrationFiles);
  let playableMigrationIds: MigrationFile[] = [...allMigrationFiles];
  let lastId: ObjectId | undefined = undefined;
  if (res.length) {
    lastId = res?.[0]?._id;
    const indexOfLastMigration: number = allMigrationFiles.findIndex(f => f.id === lastId?.toString());
    if (indexOfLastMigration < 0) {
      throw Error("Last migration not found locally");
    }
    playableMigrationIds = allMigrationFiles.slice(indexOfLastMigration + 1);
  } else {
    logger.info(`This is the first migration. ${playableMigrationIds.length} migration(s) will be applied now.`);
  }
  await playMigrations(playableMigrationIds);
}

async function playMigrations(migrationFiles: MigrationFile[]): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await playMigration(migrationFile);
  }
}

async function playMigration(migrationFile: MigrationFile): Promise<void> {
  const migrationColl: Collection<MigrationDoc> = client.db(process.env.DB_NAME || "scim").collection("migrations");
  const fileUrl = pathToFileURL(path.join(process.cwd(), BASE_PATH, migrationFile.fileName)).href;
  const currentModule = await import(fileUrl);
  const currentMigration = new currentModule.Migration();
  try {
    await currentMigration.up(client);
    logger.info(`Migration [${migrationFile.id}] 'up' stage completed successfully`);
  } catch (e: any) {
    try {
      logger.error(`Migration failed during the 'up' stage: ${e?.message ?? e}`);
      await currentMigration.down(client);
      throw e;
    } catch (rollbackErr: any) {
      logger.error(`Rollback failed; check integrity! Error: ${rollbackErr?.message ?? rollbackErr}`);
      throw e;
    }

  }
  try {
    await currentMigration.dataUp(client);
    logger.info(`Migration [${migrationFile.id}] 'dataUp' stage completed successfully`);
  } catch (e: any) {
    try {
      logger.error(`Migration failed during the 'dataUp' stage: ${e?.message ?? e}`);
      await currentMigration.dataDown(client)
      await currentMigration.down(client);
      throw e;
    } catch (rollbackErr: any) {
      logger.error(`Rollback failed; check migration integrity! Error: ${rollbackErr?.message ?? rollbackErr}`);
      throw e;
    }
  }

  await migrationColl.insertOne({ _id: currentMigration.id, appliedAt: new Date() });
  logger.info(`Migration [${migrationFile.id}] processed successfully`);
}

migrate().then(() => process.exit(0)).catch(e => console.log(e));
