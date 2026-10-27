import { getDatabase } from "../../../config/database";
import { env } from "../../../config/env";

export interface RetrievalReadiness {
  ready: boolean;
  checks: Record<string, { ready: boolean; detail?: string | number | boolean }>;
}

export class RetrievalReadinessService {
  async check(): Promise<RetrievalReadiness> {
    const checks: RetrievalReadiness["checks"] = {
      databaseConfigured: { ready: Boolean(env.mongodbUri && env.mongodbDbName) },
      embeddingConfigured: { ready: Boolean(env.mistralApiKey && env.mistralEmbedModel), detail: env.mistralEmbedModel },
      embeddingDimensionConfigured: { ready: Number.isInteger(env.embeddingDimension) && env.embeddingDimension > 0, detail: env.embeddingDimension },
    };
    if (checks.databaseConfigured.ready) {
      try {
        const db = await getDatabase();
        await db.command({ ping: 1 });
        const collection = db.collection(env.mongodbCollectionName);
        const [documentCount, indexedCount, indexes] = await Promise.all([
          collection.estimatedDocumentCount(),
          collection.countDocuments({ embedding: { $type: "array", $ne: [] } }),
          collection.listSearchIndexes().toArray(),
        ]);
        const vectorIndex = indexes.find((index: any) => index.name === env.resumeVectorIndexName);
        const vectorField = (vectorIndex as any)?.latestDefinition?.fields?.find(
          (field: any) => field.type === "vector" && field.path === "embedding",
        );
        checks.database = { ready: true, detail: env.mongodbDbName };
        checks.resumeCollection = { ready: true, detail: env.mongodbCollectionName };
        checks.resumeDocuments = { ready: documentCount > 0, detail: documentCount };
        checks.embeddedResumes = { ready: indexedCount > 0, detail: indexedCount };
        checks.vectorIndex = { ready: Boolean(vectorField), detail: vectorIndex ? env.resumeVectorIndexName : "missing" };
        checks.vectorDimensions = {
          ready: Boolean(vectorField) && vectorField.numDimensions === env.embeddingDimension,
          detail: vectorField?.numDimensions ?? "unknown",
        };
      } catch (error) {
        checks.database = { ready: false, detail: "Database readiness check failed" };
        checks.resumeCollection = { ready: false };
        checks.resumeDocuments = { ready: false };
        checks.embeddedResumes = { ready: false };
        checks.vectorIndex = { ready: false };
        checks.vectorDimensions = { ready: false };
      }
    } else {
      checks.database = { ready: false };
      checks.resumeCollection = { ready: false };
      checks.resumeDocuments = { ready: false };
      checks.embeddedResumes = { ready: false };
      checks.vectorIndex = { ready: false };
      checks.vectorDimensions = { ready: false };
    }
    return { ready: Object.values(checks).every((check) => check.ready), checks };
  }
}
