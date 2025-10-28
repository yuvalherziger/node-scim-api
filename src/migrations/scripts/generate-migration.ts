import ejs from "ejs";
import path from "path";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import { parseArgs } from "node:util";
import { logger } from "../../common/logger.js";

const TEMPLATE_FILE = "migration.ejs";
const BASE_PATH: string = "src/migrations/";
const resolvedPath: string = path.join(process.cwd(), BASE_PATH, "templates/", TEMPLATE_FILE);

const pad = (num: number, maxLength: number = 2) => String(num).padStart(maxLength, "0");

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function writeNewMigrationFile(args: any) {
  const { name } = args;
  const now = new Date(new Date().toUTCString().slice(0, -4));
  const timestamp: string = formatDate(now);
  const hash: string = new ObjectId().toString();
  const outFileName: string = `m-${timestamp}-${hash}-${name}.ts`;
  const outFilePath: string = path.join(process.cwd(), BASE_PATH, outFileName);

  const data = { timestamp, hash, name };
  ejs.renderFile(resolvedPath, data, (err: Error | null, content: string) => {
    if (err) {
      logger.error(err);
      return;
    }
    fs.writeFile(outFilePath, content, "utf8", (err: Error | null) => {
      if (err) {
        logger.error("Error writing to file:", err);
      } else {
        logger.info(
          `Migration successfully written to %s. Edit this TS file to implement the migration`,
          outFilePath
        );
      }
    });
  });
}

const args = process.argv;
const options: any = {
  name: {
    type: "string",
    short: "n",
    default: "default"
  }
};
const {
  values
} = parseArgs({ args, options, allowPositionals: true });

writeNewMigrationFile(values);
