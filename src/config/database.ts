import { Db, MongoClient } from "mongodb";
import { env } from "./env";

let client: MongoClient | undefined;
let database: Db | undefined;

export async function getDatabase(): Promise<Db> {
  if (database) {
    return database;
  }

  if (!env.mongodbUri || !env.mongodbDbName) {
    throw new Error("MongoDB configuration is missing");
  }

  client = new MongoClient(env.mongodbUri);
  await client.connect();
  database = client.db(env.mongodbDbName);
  return database;
}

export async function checkDatabase(): Promise<number> {
  const startedAt = Date.now();
  const db = await getDatabase();
  await db.command({ ping: 1 });
  await db.collection(env.mongodbCollectionName).estimatedDocumentCount();
  return Date.now() - startedAt;
}

export async function closeDatabase(): Promise<void> {
  await client?.close();
  client = undefined;
  database = undefined;
}
