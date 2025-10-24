import { MongoClient } from "mongodb";
const defaultMongoDbUri = "mongodb://localhost:27017/?directConnection=true";
const defaultDatabase = "scim";
const mongoDbUri = process.env.MONGODB_URI || defaultMongoDbUri;
const dbName = process.env.DB_NAME || defaultDatabase;
export const client = new MongoClient(mongoDbUri);
export const db = client.db(dbName);
//# sourceMappingURL=db.js.map