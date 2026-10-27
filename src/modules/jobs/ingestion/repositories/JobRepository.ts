import { getDatabase } from "../../../../config/database";
import { env } from "../../../../config/env";
import { ObjectId } from "mongodb";
import type { ApplicationStatus, Job, JobActivity, JobDashboardOverview, TailoredCv } from "../../types/job.types";

export type JobApplicationUpdate = Partial<Pick<Job, "status" | "appliedAt" | "interviewDate" | "applicationMessage" | "matchAnalysis" | "interviewPreparation">>;

type JobDashboardFacet = {
  stats: JobDashboardOverview["stats"][];
  activity: JobActivity[];
};

/**
 * JobRepository
 *
 * MongoDB access for the jobs collection.
 * Follows the same getDatabase() pattern as ResumeIngestionRepository.
 *
 * Phase 2: identity lookups, count, unique indexes.
 * Later phases reuse this class for upsert, embeddings, and search.
 */
export class JobRepository {
  private get collectionName(): string {
    return env.jobCollectionName;
  }

  /**
   * Unique indexes on jobId and source.url so repeated ingestion cannot
   * create duplicate jobs. Safe to call more than once.
   */
  async ensureIndexes(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection(this.collectionName);
    await collection.createIndex({ jobId: 1 }, { unique: true, name: "jobId_unique" });
    await collection.createIndex({ "source.url": 1 }, { unique: true, name: "source_url_unique" });
    await collection.createIndex({ contentHash: 1 }, { name: "contentHash" });
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  /**
   * Idempotent upsert keyed on jobId.
   * Returns { upsertedId, alreadyExisted }.
   */
  async upsertJob(job: Omit<Job, "_id">): Promise<{ jobId: string; alreadyExisted: boolean }> {
    const db = await getDatabase();
    const result = await db.collection(this.collectionName).updateOne(
      { jobId: job.jobId },
      { $setOnInsert: { createdAt: new Date() }, $set: { ...job, updatedAt: new Date() } },
      { upsert: true }
    );

    const alreadyExisted = result.upsertedCount === 0;
    return { jobId: job.jobId, alreadyExisted };
  }

  /**
   * Update the embedding fields on an existing job document.
   */
  async updateEmbedding(
    jobId: string,
    embedding: number[],
    model: string,
    dimensions: number
  ): Promise<void> {
    const db = await getDatabase();
    await db.collection(this.collectionName).updateOne(
      { jobId },
      { $set: { embedding, embeddingModel: model, embeddingDimensions: dimensions, updatedAt: new Date() } }
    );
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async findByJobId(jobId: string): Promise<Job | null> {
    const db = await getDatabase();
    return (await db.collection(this.collectionName).findOne({ jobId })) as Job | null;
  }

  async findByJobIds(jobIds: string[]): Promise<Job[]> {
    const db = await getDatabase();
    return (await db.collection(this.collectionName)
      .find({ jobId: { $in: jobIds } }, { projection: { embedding: 0 } })
      .toArray()) as Job[];
  }

  async saveJob(jobId: string): Promise<Job | null> {
    const db = await getDatabase();
    const collection = db.collection(this.collectionName);
    const now = new Date();
    const existing = await collection.findOne({ jobId });
    if (!existing) return null;

    const values: Record<string, unknown> = { updatedAt: now };
    if (!existing.savedAt) values.savedAt = now;
    if (!existing.status) values.status = "SAVED" satisfies ApplicationStatus;
    await collection.updateOne({ jobId }, { $set: values });
    return this.findByJobId(jobId);
  }

  async listSavedJobs(): Promise<Job[]> {
    const db = await getDatabase();
    return (await db.collection(this.collectionName)
      .find({ savedAt: { $exists: true, $ne: null } }, { projection: { embedding: 0 } })
      .sort({ savedAt: -1 })
      .toArray()) as Job[];
  }

  async updateApplicationTracking(jobId: string, update: JobApplicationUpdate): Promise<Job | null> {
    const db = await getDatabase();
    const result = await db.collection(this.collectionName).updateOne(
      { jobId },
      { $set: { ...update, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return null;
    return this.findByJobId(jobId);
  }

  async saveTailoredCv(jobId: string, tailoredCv: TailoredCv): Promise<Job | null> {
    const db = await getDatabase();
    const result = await db.collection(this.collectionName).updateOne(
      { jobId },
      { $set: { tailoredCv, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return null;
    return this.findByJobId(jobId);
  }

  async findBySourceUrl(url: string): Promise<Job | null> {
    const db = await getDatabase();
    return (await db.collection(this.collectionName).findOne({ "source.url": url })) as Job | null;
  }

  async findById(id: string): Promise<Job | null> {
    const db = await getDatabase();
    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id;
    return (await db
      .collection(this.collectionName)
      .findOne({ _id: objectId as any })) as Job | null;
  }

  /**
   * Load all jobs that have embeddings — used as the BM25 corpus.
   * Excludes the embedding vector itself to keep the payload small.
   */
  async listJobsForBM25(): Promise<Job[]> {
    const db = await getDatabase();
    return (await db
      .collection(this.collectionName)
      .find(
        {},
        {
          projection: {
            _id: 1,
            jobId: 1,
            title: 1,
            company: 1,
            location: 1,
            description: 1,
            requiredSkills: 1,
            preferredSkills: 1,
            technologies: 1,
            responsibilities: 1,
            rawText: 1,
          },
        }
      )
      .toArray()) as Job[];
  }

  /**
   * Atlas Vector Search — returns top-K jobs by cosine similarity.
   * Phase 5 will implement the full $vectorSearch aggregation pipeline.
   */
  async findByVector(queryVector: number[], topK: number): Promise<Job[]> {
    const db = await getDatabase();

    const pipeline = [
      {
        $vectorSearch: {
          index: env.jobVectorIndexName,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(topK * 10, 20),
          limit: topK,
        },
      },
      {
        $project: {
          _id: 1,
          jobId: 1,
          title: 1,
          company: 1,
          location: 1,
          remote: 1,
          source: 1,
          description: 1,
          requiredSkills: 1,
          preferredSkills: 1,
          technologies: 1,
          responsibilities: 1,
          employmentType: 1,
          publishedAt: 1,
          discoveredAt: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    return (await db
      .collection(this.collectionName)
      .aggregate(pipeline)
      .toArray()) as Job[];
  }

  async countJobs(): Promise<number> {
    const db = await getDatabase();
    return db.collection(this.collectionName).estimatedDocumentCount();
  }

  async getDashboardOverview(): Promise<JobDashboardOverview> {
    const db = await getDatabase();
    const collectedAt = { $ifNull: ["$createdAt", "$discoveredAt"] };
    const countableApplications = ["APPLIED", "INTERVIEW", "OFFER", "REJECTED", "CLOSED"];
    const results = await db.collection(this.collectionName)
      .aggregate<JobDashboardFacet>([
        {
          $facet: {
            stats: [
              {
                $group: {
                  _id: null,
                  totalJobs: { $sum: 1 },
                  savedJobs: {
                    $sum: { $cond: [{ $ne: [{ $ifNull: ["$savedAt", null] }, null] }, 1, 0] },
                  },
                  applications: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $ne: [{ $ifNull: ["$appliedAt", null] }, null] },
                            { $in: ["$status", countableApplications] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  interviews: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$status", "INTERVIEW"] },
                            { $ne: [{ $ifNull: ["$interviewDate", null] }, null] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  offers: { $sum: { $cond: [{ $eq: ["$status", "OFFER"] }, 1, 0] } },
                },
              },
              { $project: { _id: 0 } },
            ],
            activity: [
              {
                $project: {
                  _id: 0,
                  events: {
                    $concatArrays: [
                      {
                        $cond: [
                          { $ne: [collectedAt, null] },
                          [{ type: "job_discovered", jobId: "$jobId", title: "$title", company: "$company", occurredAt: collectedAt }],
                          [],
                        ],
                      },
                      ...([
                        ["job_saved", "$savedAt"],
                        ["application_submitted", "$appliedAt"],
                        ["interview_scheduled", "$interviewDate"],
                        ["resume_match", "$matchAnalysis.analysedAt"],
                        ["tailored_cv_saved", "$tailoredCv.savedAt"],
                        ["interview_prepared", "$interviewPreparation.preparedAt"],
                      ] as const).map(([type, occurredAt]) => ({
                        $cond: [
                          { $ne: [{ $ifNull: [occurredAt, null] }, null] },
                          [{ type, jobId: "$jobId", title: "$title", company: "$company", occurredAt }],
                          [],
                        ],
                      })),
                    ],
                  },
                },
              },
              { $unwind: "$events" },
              { $sort: { "events.occurredAt": -1 } },
              { $limit: 8 },
              { $replaceRoot: { newRoot: "$events" } },
            ],
          },
        },
      ])
      .next();

    const stats = results?.stats[0];
    return {
      stats: {
        totalJobs: stats?.totalJobs ?? 0,
        savedJobs: stats?.savedJobs ?? 0,
        applications: stats?.applications ?? 0,
        interviews: stats?.interviews ?? 0,
        offers: stats?.offers ?? 0,
      },
      activity: results?.activity ?? [],
    };
  }

  async saveApplicationMessage(message: {
    jobId: string;
    candidateId: string;
    message: string;
    evidenceUsed: string[];
    generatedAt: Date;
    status: "DRAFT";
  }): Promise<string> {
    const db = await getDatabase();
    const result = await db.collection(`${this.collectionName}_application_messages`).insertOne(message);
    return String(result.insertedId);
  }

  async ensureApplicationMessageIndexes(): Promise<void> {
    const db = await getDatabase();
    await db.collection(`${this.collectionName}_application_messages`).createIndex({ jobId: 1, generatedAt: -1 }, { name: "job_message_history" });
  }
}
