import "dotenv/config";

import { QueryEmbeddingService } from "./src/modules/retrieval/services/QueryEmbeddingService";
import { ResumeRetrievalRepository } from "./src/modules/retrieval/repositories/ResumeRetrievalRepository";

async function main() {
  const query = "Find a Test Architect with RAG and GenAI experience";

  console.log("=================================");
  console.log("PHASE 21 — VECTOR SEARCH TEST");
  console.log("=================================");

  console.log("\nQuery:");
  console.log(query);

  // Phase 20
  const embeddingService = new QueryEmbeddingService();

  console.log("\nGenerating query embedding...");

  const startEmbedding = Date.now();

  const queryEmbedding = await embeddingService.embedText(query);

  const embeddingMs = Date.now() - startEmbedding;

  console.log("Embedding dimension:", queryEmbedding.length);
  console.log("Embedding time:", `${embeddingMs} ms`);

  if (queryEmbedding.length !== 1024) {
    throw new Error(
      `Invalid query embedding dimension: ${queryEmbedding.length}`
    );
  }

  console.log("✅ Query embedding valid");

  // Phase 21
  const repository = new ResumeRetrievalRepository();

  console.log("\nExecuting MongoDB Atlas Vector Search...");

  const startSearch = Date.now();

  const results = await repository.findByVector(
    queryEmbedding,
    5
  );

  const vectorSearchMs = Date.now() - startSearch;

  console.log("Vector search time:", `${vectorSearchMs} ms`);
  console.log("Results found:", results.length);

  console.log("\nResults:");

  for (const [index, result] of results.entries()) {
    console.log(`\n--- Result ${index + 1} ---`);

    console.log({
      id: result._id,
      name: result.name,
      role: result.role,
      company: result.company,
      skills: result.skills,
      score: (result as any).score
    });
  }

  if (results.length === 0) {
    console.log("\n❌ PHASE 21 FAILED");
    console.log("MongoDB Vector Search returned 0 results.");
    return;
  }

  console.log("\n=================================");
  console.log("✅ PHASE 21 PASSED");
  console.log("Query");
  console.log("  ↓");
  console.log("Mistral embedding");
  console.log("  ↓");
  console.log("1024-dimensional vector");
  console.log("  ↓");
  console.log("MongoDB Atlas Vector Search");
  console.log("  ↓");
  console.log(`${results.length} candidate(s)`);
  console.log("=================================");
}

main().catch((error) => {
  console.error("\n❌ PHASE 21 FAILED");
  console.error(error);
  process.exit(1);
});