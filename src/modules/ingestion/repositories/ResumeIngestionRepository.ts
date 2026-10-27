import { getDatabase } from "../../../config/database";
import { env } from "../../../config/env";
import type { ResumeDocument } from "../types/ingestion.types";

export class ResumeIngestionRepository {
  async insertResume(document: ResumeDocument): Promise<string> {
    const db = await getDatabase();
    const result = await db.collection(env.mongodbCollectionName).insertOne(document);
    return result.insertedId.toString();
  }
}
