import { ObjectId } from "mongodb";
import { getDatabase } from "../../../config/database";
import type { InterviewSession } from "../types/interviewTypes";

export class InterviewSessionRepository {
  private readonly collectionName = "interview_sessions";
  async insert(session: InterviewSession): Promise<string> {
    const db = await getDatabase();
    const result = await db.collection<InterviewSession>(this.collectionName).insertOne(session);
    return String(result.insertedId);
  }
  async findById(id: string): Promise<InterviewSession | null> {
    if (!ObjectId.isValid(id)) return null;
    const db = await getDatabase();
    return db.collection<InterviewSession>(this.collectionName).findOne({ _id: new ObjectId(id) });
  }
  async update(id: string, session: InterviewSession): Promise<void> {
    if (!ObjectId.isValid(id)) return;
    const db = await getDatabase();
    const { _id: _ignored, ...document } = session;
    await db.collection<InterviewSession>(this.collectionName).replaceOne({ _id: new ObjectId(id) }, document);
  }
  async ensureIndexes(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<InterviewSession>(this.collectionName);
    await collection.createIndex({ jobId: 1, createdAt: -1 }, { name: "interview_job_history" });
    await collection.createIndex({ candidateId: 1, createdAt: -1 }, { name: "interview_candidate_history" });
  }
}
