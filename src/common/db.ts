import { MongoClient } from "mongodb";

const defaultMongoDbUri: string = "mongodb://localhost:27017/?directConnection=true"
const defaultDatabase: string = "scim"
const mongoDbUri: string = process.env.MONGODB_URI || defaultMongoDbUri;
const dbName: string = process.env.DB_NAME || defaultDatabase;

export const client: MongoClient = new MongoClient(mongoDbUri);

export const db = client.db(dbName);
