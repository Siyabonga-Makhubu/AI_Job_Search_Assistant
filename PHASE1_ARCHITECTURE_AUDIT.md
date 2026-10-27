# Resume RAG: Phase 1 Architecture Audit

**Audit date:** 2026-09-25  
**Scope:** Repository inspection and implementation plan only. No job behavior or MCP features were implemented in this phase.

## Existing architecture

- Backend: Node.js, TypeScript 5.9, Express 5, CommonJS output, MongoDB Node driver 7.
- Package manager: npm (`package-lock.json`). `package.json` has `dev`, `dev:mcp`, `build`, `start`, `mcp:start`, and `test` scripts.
- TypeScript is strict; source and tests under `src/` compile to `dist/`.
- Express setup is in `src/app.ts`; `src/server.ts` starts the HTTP server. Route groups are mounted at `/v1`.
- MongoDB is lazily connected and shared through `src/config/database.ts` and `getDatabase()`.
- Shared environment configuration is in `src/config/env.ts`; `.env.example` documents configuration. `.env` was not inspected for secrets.
- No root `README.md` is present. Architecture and operational guidance are in the two phase implementation documents, `src/modules/retrieval/README.md`, and `mcp-markdown.md`.

## Existing Resume RAG capabilities

- Ingestion: `ResumeIngestionService` extracts PDF text, cleans and parses it, generates an embedding, and stores structured resume data. Algorithmic and optional LLM parsers and the existing skill catalogue are under `src/modules/ingestion/services/` and `src/config/skills.ts`.
- Resume records include raw text, name/contact fields, location, company, role, education, experience, skills, job titles, experience summary, embedding/model/dimension, and timestamps. The current schema has no first-class structured projects collection/field.
- MongoDB persistence uses the shared database and configured resume collection.
- Retrieval: `ResumeRetrievalService` owns query normalization, metadata filtering, query embedding, Atlas vector retrieval, BM25, hybrid fusion, deduplication/reranking, and grounded answer generation. `ResumeRetrievalRepository` and the retrieval services are reusable for candidate evidence.
- Existing retrieval tests are in `src/modules/retrieval/__tests__/retrieval.test.ts`; ingestion tests are in `src/modules/ingestion/__tests__/ingestion.test.ts`.

## Existing MongoDB/vector/BM25 capabilities

- Resume ingestion and retrieval use one shared MongoDB connection and resume collection.
- Resume vector search is Atlas `$vectorSearch`; embeddings are generated through the existing Mistral integration and configured model/dimension.
- BM25 is implemented in `src/modules/retrieval/services/BM25Service.ts`; resume hybrid search already combines lexical and vector retrieval with its own ranking pipeline.
- A separate `jobs` collection is configured. `JobRepository` contains unique indexes for job ID/source URL, idempotent upsert, document lookup, BM25 corpus loading, and an Atlas vector-search aggregation.
- Job embedding metadata fields are in the job type/repository, but job ingestion does not yet call an embedding generator. Search is a stub; job hybrid fusion is not implemented. Atlas index availability/configuration was not verified against a live cluster.

## Existing REST APIs

Routes are mounted in `src/app.ts` under `/v1`:

- Resume ingestion: `/resume/health`, `/resume/upload`, `/resume/extract`, `/resume/clean`, `/resume/regex`, `/resume/skills`, `/resume/parse`, `/resume/llm-parse`, `/resume/embed`, `/resume/store`, `/resume/ingest`.
- Resume retrieval: `/retrieval/health`, `/resume/library`, `/resume/stats`, `/resume/duplicates/preview`, `/resume/duplicates/delete`, `/resume/:resumeId`, `/resume/search/raw`, `/resume/search`.
- Jobs: `GET /jobs/health`, `GET /jobs/config`, `GET /jobs/:jobId`; discovery, ingest, search, match, application-message, and analyse endpoints are registered but currently return `501 PHASE_NOT_IMPLEMENTED`.
- Health endpoints include `/health` and `/health/db`.

## Existing MCP implementation

- MCP already exists. `@modelcontextprotocol/sdk` is declared as `^1.17.0`; installed version inspected locally is `1.17.0`.
- Separate `src/mcp-server.ts` entry point creates `McpServer` and uses `StdioServerTransport`; `npm run dev:mcp` and `npm run mcp:start` launch it separately from Express.
- `src/modules/mcp/server/resumeMcpServer.ts` registers resume search, candidate/profile, candidate evidence, job-description-to-candidate matching, and duplicate-resume tools. `resumeResources.ts` registers read-only resume library/candidate resources.
- There are no job-domain MCP tools/resources for discovering/storing/searching jobs, matching one job to the candidate, or drafting an application message. Existing MCP tools call resume/retrieval-level functions; the new job capabilities should call the same core job services used by REST.
- `mcp-markdown.md` is design documentation, not an additional server implementation.

## Reusable components

- Shared MongoDB connection/configuration: `src/config/database.ts`, `src/config/env.ts`.
- Resume extraction, normalization, parsed metadata, skill catalogue, and Mistral embedding integration under `src/modules/ingestion/`.
- Resume hybrid retrieval and evidence repositories under `src/modules/retrieval/`.
- Existing Express middleware, route/controller conventions, and error handling.
- Job foundation already present under `src/modules/jobs/`: normalized types, URL/hash/cleaning utilities, parser, provider interface, generic-web provider placeholder, discovery/ingestion/search/matching/evidence services, MongoDB repository, controller, routes, and tests.
- MCP SDK server/stdio setup, tool registration, resources, and MCP error response conventions under `src/modules/mcp/`.

## New components or completion work required

- Complete the existing job skeleton rather than create a parallel job implementation: wire provider URL retrieval, parser, content hash/upsert, embeddings, and structured validation into ingestion.
- Provide a supported discovery provider; generic direct URL ingestion should remain available independently of discovery. No LinkedIn scraping implementation currently exists.
- Implement job retrieval over the jobs collection, with BM25/vector candidate merge and deduplication; validate model/dimensions against the existing embedding setup.
- Turn `CandidateEvidenceService` into a scoped adapter over the existing Resume RAG retrieval/repository, then complete grounded requirement classification and analysis.
- Add an `ApplicationMessageService` and persistent DRAFT history using verified job and candidate evidence.
- Replace job REST 501 handlers with controllers delegating to job application services, including a combined analysis path.
- Register focused job MCP tools that call those same services; add only appropriately scoped job/match resources if useful.
- Add verification for job ingestion/search/matching/message generation and REST/MCP service consistency in later phases.

## Potential conflicts and risks

- Job types and service comments describe intended functionality that is not yet implemented; current signatures must not be mistaken for working features.
- `JobIngestionService` currently accepts a URL but cleans `rawText ?? ""` without fetching that URL, then fails the empty-text check. Its current minimal record uses `title: "Pending parse"`.
- Job matching currently classifies every extracted skill as `NOT_EVIDENCED` without retrieval. Candidate evidence lookup currently returns an empty list. Job search's primary method returns an empty list.
- `GenericWebProvider.getJob()` is a stub and generic search intentionally is unsupported. There is no configured live job discovery provider.
- Candidate records represent resume documents; single-user fallback uses the first listed record, which is not guaranteed to be the newest. Projects/certifications are not independently structured by current resume schema.
- Job embedding generation cannot be assumed compatible until it uses/validates the shared embedding model and dimension.
- Existing MCP includes a destructive duplicate-deletion tool guarded by explicit confirmation; future job tools should remain limited to user-authorized operations and must not submit applications or send messages.
- MCP is currently stdio-only and isolated as a separate process, which suits local clients. REST and MCP need a shared composition/service layer to keep job business logic consistent.
- Live MongoDB Atlas, Mistral, job source, and MCP-client integration cannot be asserted from local compilation/tests alone.

## Implementation plan

The user's staged implementation sequence is retained, adapted to the existing modules. Complete and verify each stage before proceeding; Phase 1 is this audit only.

1. **Phase 1 — Architecture audit (complete):** document framework, current workflows, APIs, MCP, integration points, constraints, and risks.
2. **Phase 2 — Job domain foundation:** finalize job types/configuration, repository/index setup, controller/routes, and shared application-service composition while preserving existing resume routes.
3. **Phase 3 — Job ingestion:** implement lawful provider abstraction, URL/text loading, cleaning, deterministic/validated parsing, normalization, and deduplication.
4. **Phase 4 — Job storage:** finish MongoDB indexes and deterministic idempotent upsert/content hash behavior.
5. **Phase 5 — Job embeddings:** reuse the resume embedding configuration and validate model, vector type, and dimensions before persistence.
6. **Phase 6 — Job retrieval:** complete BM25, Atlas vector search, hybrid merge/deduplication, and filters.
7. **Phase 7 — Candidate evidence:** retrieve evidence for the selected candidate through existing Resume RAG components.
8. **Phase 8 — Job matching:** classify each requirement as MATCHED, PARTIAL, or NOT_EVIDENCED with traceable evidence.
9. **Phase 9 — Application draft:** generate a grounded message and persist history with DRAFT default; preserve human review/submission control.
10. **Phase 10 — REST APIs:** wire discover, ingest, search, match, application-message, and combined analyse routes to core services.
11. **Phase 11 — MCP server:** add focused job tools/resources to the existing MCP implementation, delegating to the same services as REST.
12. **Phase 12 — MCP client verification:** test stdio tool discovery/calls with a compatible client when available.
13. **Phase 13 — End-to-end verification:** run unit/integration checks and verify external dependencies only when credentials/access are available.

## Phase 1 status

**STATUS: COMPLETE** — repository inspection and this report are the only Phase 1 deliverables. No runtime behavior was changed.
