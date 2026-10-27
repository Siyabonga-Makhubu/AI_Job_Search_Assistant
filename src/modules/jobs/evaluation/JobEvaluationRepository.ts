import { getDatabase } from "../../../config/database";
import { env } from "../../../config/env";
import type { ObjectId } from "mongodb";
import type {
  EvaluationCacheDocument,
  EvaluationHistoryFilters,
  EvaluationResultDocument,
} from "./evaluation.types";

/** MongoDB storage for individual metric results and reusable metric cache entries. */
export class JobEvaluationRepository {
  private indexesReady: Promise<void> | undefined;

  private get resultsCollectionName(): string {
    return `${env.jobCollectionName}_evaluation_results`;
  }

  private get cacheCollectionName(): string {
    return `${env.jobCollectionName}_evaluation_cache`;
  }

  private async ensureIndexes(): Promise<void> {
    this.indexesReady ??= (async () => {
      const db = await getDatabase();
      await Promise.all([
        db.collection(this.resultsCollectionName).createIndex(
          { timestamp: -1 },
          { name: "evaluation_timestamp" },
        ),
        db.collection(this.resultsCollectionName).createIndex(
          { query: 1, runId: 1 },
          { name: "evaluation_query_run" },
        ),
        db.collection(this.cacheCollectionName).createIndex(
          { cacheKey: 1 },
          { unique: true, name: "evaluation_cache_key_unique" },
        ),
      ]);
    })();
    await this.indexesReady;
  }

  async findCached(cacheKey: string): Promise<EvaluationCacheDocument | null> {
    await this.ensureIndexes();
    const db = await getDatabase();
    return db.collection<EvaluationCacheDocument>(this.cacheCollectionName)
      .findOne({ cacheKey });
  }

  async saveCached(cacheKey: string, result: EvaluationResultDocument): Promise<void> {
    await this.ensureIndexes();
    const db = await getDatabase();
    const { runId: _runId, cached: _cached, ...metric } = result;
    await db.collection<EvaluationCacheDocument>(this.cacheCollectionName).updateOne(
      { cacheKey },
      { $set: { ...metric, cacheKey } },
      { upsert: true },
    );
  }

  async insertResults(results: EvaluationResultDocument[]): Promise<void> {
    if (!results.length) return;
    await this.ensureIndexes();
    const db = await getDatabase();
    await db.collection<EvaluationResultDocument>(this.resultsCollectionName).insertMany(results);
  }

  async listResults(
    filters: EvaluationHistoryFilters,
    limit = 1000,
  ): Promise<Array<EvaluationResultDocument & { _id: ObjectId }>> {
    await this.ensureIndexes();
    const db = await getDatabase();
    const query: Record<string, unknown> = {};
    if (filters.query) query.query = { $regex: escapeRegex(filters.query), $options: "i" };
    if (filters.metricName) query.metricName = filters.metricName;
    if (filters.passed !== undefined) query.passed = filters.passed;
    if (filters.from || filters.to) {
      query.timestamp = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    return db.collection<EvaluationResultDocument & { _id: ObjectId }>(this.resultsCollectionName)
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
