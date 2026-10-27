import "dotenv/config";
import { QueryEmbeddingService } from "./src/modules/retrieval/services/QueryEmbeddingService";

async function main() {
  const service = new QueryEmbeddingService();

  const query =
    "Find a Test Architect with RAG and GenAI experience";

  console.log("Query:");
  console.log(query);

  const start = Date.now();

  const embedding = await service.embedText(query);

  const elapsed = Date.now() - start;

  console.log("\nPhase 20 result:");
  console.log("Embedding type:", Array.isArray(embedding) ? "number[]" : typeof embedding);
  console.log("Embedding dimension:", embedding.length);
  console.log("Embedding time:", `${elapsed} ms`);

  console.log("\nEmbedding preview:");
  console.log(embedding.slice(0, 10));

  if (embedding.length !== 1024) {
    throw new Error(
      `Phase 20 FAILED: expected 1024 dimensions, received ${embedding.length}`
    );
  }

  console.log("\n✅ PHASE 20 PASSED");
  console.log("Query → Mistral → number[] → 1024 dimensions");
}

main().catch((error) => {
  console.error("\n❌ PHASE 20 FAILED");
  console.error(error);
  process.exit(1);
});