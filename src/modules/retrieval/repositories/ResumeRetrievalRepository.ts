import { getDatabase } from "../../../config/database";
import { env } from "../../../config/env";
import { ObjectId } from "mongodb";
import type { StoredResume } from "../types/retrieval.types";

export class ResumeRetrievalRepository {
  async listResumes(): Promise<StoredResume[]> {
    const db = await getDatabase();

    return (await db.collection(env.mongodbCollectionName).find(
      {},
      {
        projection: {
          _id: 1,
          name: 1,
          role: 1,
          company: 1,
          location: 1,
          education: 1,
          skills: 1,
          totalExperience: 1,
          relevantExperience: 1,
          jobTitles: 1,
          experienceSummary: 1,
          embedding: 1,
          embeddingDimension: 1,
          createdAt: 1,
          rawText: 1,
        },
      // ObjectId breaks ties when two files are ingested within the same ms.
      sort: { createdAt: -1, _id: -1 },
      },
    ).toArray()) as StoredResume[];
  }

  async getStats(): Promise<{ resumeCount: number; indexedCount: number }> {
    const db = await getDatabase();
    const collection = db.collection(env.mongodbCollectionName);

    const [resumeCount, indexedCount] = await Promise.all([
      collection.estimatedDocumentCount(),
      collection.countDocuments({ embedding: { $exists: true } })
    ]);

    return { resumeCount, indexedCount };
  }

  async findById(resumeId: string): Promise<StoredResume | null> {
    const db = await getDatabase();
    const id = ObjectId.isValid(resumeId) ? new ObjectId(resumeId) : resumeId;
    const document = await db.collection(env.mongodbCollectionName).findOne(
      { _id: id as any },
      {
        projection: {
          _id: 1,
          name: 1,
          role: 1,
          company: 1,
          address: 1,
          email: 1,
          phone: 1,
          location: 1,
          education: 1,
          totalExperience: 1,
          relevantExperience: 1,
          skills: 1,
          jobTitles: 1,
          experienceSummary: 1,
          rawText: 1,
          fileName: 1,
        }
      }
    );

    return document as StoredResume | null;
  }

  /**
   * Pure semantic retrieval using MongoDB Atlas Vector Search.
   */
  async findByVector(
    queryVector: number[],
    topK: number = 5
  ): Promise<StoredResume[]> {
    const db = await getDatabase();

    const pipeline = [
      {
        $vectorSearch: {
          index: env.resumeVectorIndexName,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(topK * 10, 20),
          limit: topK
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          address: 1,
          email: 1,
          phone: 1,
          role: 1,
          company: 1,
          location: 1,
          education: 1,
          skills: 1,
          totalExperience: 1,
          experienceSummary: 1,
          rawText: 1,
          embedding: 1,
          embeddingModel: 1,
          embeddingDimension: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];

    return (
      (await db
        .collection(env.mongodbCollectionName)
        .aggregate(pipeline)
        .toArray()) as StoredResume[]
    );
  }

  /**
   * Semantic retrieval with MongoDB Atlas metadata pre-filtering.
   *
   * The query is still evaluated using vector similarity, but only
   * documents satisfying the metadata filter are considered.
   */
  async findByVectorWithFilter(
    queryVector: number[],
    filter: Record<string, unknown>,
    topK: number = 5
  ): Promise<StoredResume[]> {
    const db = await getDatabase();

    const pipeline = [
      {
        $vectorSearch: {
          index: env.resumeVectorIndexName,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(topK * 10, 20),
          limit: topK,

          // Atlas applies this filter before returning
          // vector-search candidates.
          filter
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          role: 1,
          company: 1,
          location: 1,
          education: 1,
          skills: 1,
          totalExperience: 1,
          experienceSummary: 1,
          rawText: 1,
          embedding: 1,
          embeddingModel: 1,
          embeddingDimension: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];

    return (
      (await db
        .collection(env.mongodbCollectionName)
        .aggregate(pipeline)
        .toArray()) as StoredResume[]
    );
  }

  /**
   * Loads the searchable resume fields used by local BM25 retrieval.
   */
  async findAllForKeywordSearch(): Promise<StoredResume[]> {
    const db = await getDatabase();

    return (
      (await db
        .collection(env.mongodbCollectionName)
        .find(
          {},
          {
            projection: {
              _id: 1,
              name: 1,
              address: 1,
              email: 1,
              phone: 1,
              role: 1,
              company: 1,
              location: 1,
              education: 1,
              totalExperience: 1,
              relevantExperience: 1,
              skills: 1,
              jobTitles: 1,
              experienceSummary: 1,
              rawText: 1
            }
          }
        )
        .toArray()) as StoredResume[]
    );
  }

  /**
   * Plain MongoDB metadata filtering.
   *
   * Kept as a fallback/useful utility for non-vector operations.
   */
  async findWithFilter(
    filter: Record<string, unknown>,
    topK: number = 5
  ): Promise<StoredResume[]> {
    const db = await getDatabase();

    return (
      (await db
        .collection(env.mongodbCollectionName)
        .find(filter)
        .limit(topK)
        .toArray()) as StoredResume[]
    );
  }

  /**
   * Loads every document with the minimal fields needed to detect duplicates.
   *
   * Duplicate detection uses three signals in priority order:
   *   1. Normalised email address (most reliable — same person, re-uploaded)
   *   2. Normalised name + totalExperience pair (catches name-only matches)
   *   3. Normalised fileName (same file uploaded more than once)
   *
   * Documents are sorted by createdAt ascending so the NEWEST document
   * (last in each group) can be kept and the rest deleted.
   */
  async findAllForDeduplication(): Promise<
    Array<{
      _id: ObjectId | string;
      name?: string | null;
      email?: string | null;
      fileName?: string | null;
      totalExperience?: number | null;
      createdAt?: Date | string;
    }>
  > {
    const db = await getDatabase();

    return db
      .collection(env.mongodbCollectionName)
      .find(
        {},
        {
          projection: {
            _id: 1,
            name: 1,
            email: 1,
            fileName: 1,
            totalExperience: 1,
            createdAt: 1,
          },
          sort: { createdAt: 1 }, // oldest first → newest is last → keep last
        }
      )
      .toArray() as Promise<
      Array<{
        _id: ObjectId | string;
        name?: string | null;
        email?: string | null;
        fileName?: string | null;
        totalExperience?: number | null;
        createdAt?: Date | string;
      }>
    >;
  }

  /**
   * Deletes a single resume document by its ObjectId string.
   * Returns true if a document was deleted, false if nothing matched.
   */
  async deleteById(resumeId: string): Promise<boolean> {
    const db = await getDatabase();
    const id = ObjectId.isValid(resumeId) ? new ObjectId(resumeId) : resumeId;

    const result = await db
      .collection(env.mongodbCollectionName)
      .deleteOne({ _id: id as any });

    return result.deletedCount === 1;
  }
}

