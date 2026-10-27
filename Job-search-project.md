# Job Search Project

## Project overview

Job Search Project is a full-stack job-search and career-preparation application built around a Resume Retrieval-Augmented Generation (RAG) backend. It combines resume ingestion and evidence-based retrieval with job discovery, job matching, saved applications, tailored CV support, application-message drafting, and interview practice.

The system has two main user-facing parts:

- **Resume RAG API and MCP server:** processes resume PDFs, stores structured resume information, retrieves evidence, and exposes selected capabilities as REST endpoints and MCP tools.
- **Job Assistant web app:** lets a user search and save jobs, add job listings, review resume-to-job match analysis, prepare application material, and practice interviews.

The repository also contains phase-by-phase design notes and an architecture audit. Those documents describe design intent and historical findings; implementation status can change, so source code is the best reference for current behavior.

## Main capabilities

### Resume ingestion

The backend accepts resume PDFs and runs them through file handling, PDF text extraction, text cleaning, structured parsing, skill normalization, embedding generation, and MongoDB persistence. The code includes algorithmic and optional LLM-assisted parsing paths.

### Resume RAG and evidence retrieval

The retrieval module normalizes search queries, applies metadata filters, generates query embeddings, and searches resume evidence. It combines semantic vector search with lexical BM25 retrieval, merges and deduplicates results, ranks evidence, builds context, and generates grounded answers with source information. Optional LLM reranking is controlled by configuration.

The RAG design separates retrieval from generation: generated candidate claims should be supported by retrieved resume evidence, with insufficient evidence surfaced instead of invented.

### Job search and application workflow

The jobs domain contains provider abstractions for job discovery, job parsing and ingestion, URL normalization, deduplication, persistence, search and matching services, candidate-evidence adapters, tailored-CV and application-message services, and REST routes. Job discovery can depend on configured external providers and credentials. Availability of an external source is not guaranteed by local code alone.

The frontend includes job discovery, job details, saved jobs, adding a job, match analysis, and interview screens. Job data uses a separate MongoDB `jobs` collection, with configurable Atlas vector and search index names.

### Interview preparation

The interview module supports interview sessions, question generation, answer transcripts, answer evaluation, follow-up questions, topic tracking, and final feedback. The frontend includes interview pages and voice-service integration. Browser speech capabilities and configured LLM access may be required for the complete voice experience.

### Model Context Protocol (MCP)

MCP is a standard interface that allows compatible AI clients to discover and call application tools. This project has a separate MCP server process using the SDK's stdio transport. It exposes resume search, candidate/profile and evidence lookups, job-description matching, and duplicate-resume utilities, plus read-only resume resources. MCP complements the RAG and application services; it does not replace them.

The MCP server is started separately from the Express server. It communicates over standard input/output, so protocol logging is sent to standard error.

## Technology specification

### Backend

- **Runtime and language:** Node.js, TypeScript 5.9
- **HTTP framework:** Express 5
- **Database:** MongoDB using the official Node.js driver; configured for MongoDB Atlas
- **Resume embeddings:** Mistral Embeddings, default model `mistral-embed`
- **Embedding size:** configurable; default is 1024 dimensions
- **Chat and generation:** Groq through LangChain's `@langchain/groq`; model is configurable and currently defaults in code to `openai/gpt-oss-120b`
- **MCP:** `@modelcontextprotocol/sdk`, stdio transport
- **Document handling:** Multer for uploads and `pdf-parse` for PDF extraction
- **Validation and utilities:** Zod, dotenv, uuid, CORS
- **Testing/build tools:** Jest, ts-jest, TypeScript, ts-node-dev

### Frontend

- **Framework:** React 19
- **Language:** TypeScript
- **Bundler/dev server:** Vite
- **Styling:** Tailwind CSS 4 integration and project CSS
- **Icons:** lucide-react
- **Charts:** Recharts
- **Linting:** oxlint

### Search and retrieval

- MongoDB Atlas Vector Search for semantic retrieval
- BM25 lexical retrieval for keyword and exact-term matching
- Hybrid retrieval and ranking for resumes; job search configuration includes vector and full-text search index names and result limits
- Metadata filtering, deduplication, evidence selection, and grounded answer generation
- Configurable embedding model, dimensions, vector-index names, and search limits

### External services and browser capabilities

- Mistral API for resume/query embeddings
- Groq API for LLM-backed features
- Job-provider integrations are optional/configurable (the code includes provider implementations and environment settings such as JSearch and LinkedIn Jobs API credentials)
- Browser speech features may be used by the interview voice experience

External API credentials are configured outside source control. See `.env.example` for variable names and safe placeholder values; do not put secret values in this documentation.

## Architecture at a glance

```text
React + TypeScript + Vite frontend
                 |
             REST /v1
                 |
       Express + TypeScript API
        /          |          \
 Resume RAG     Job domain    Interview domain
        \          |          /
         shared services and MongoDB
                 |
      MongoDB resume and jobs data
       + Atlas vector/search indexes

Compatible AI client
        | MCP over stdio
        v
 Separate MCP server process
        |
 Shared resume/retrieval services
```

The Express routes are mounted under `/v1`. Health routes include `/v1/health` and `/v1/health/db`. The frontend's Vite configuration proxies API requests during local development.

## Main project areas

- `src/modules/ingestion/` — resume upload, extraction, parsing, embedding, and persistence
- `src/modules/retrieval/` — resume search, retrieval pipeline, ranking, context, and grounded answers
- `src/modules/jobs/` — job discovery, ingestion, parsing, matching, evidence, and application workflows
- `src/modules/interview/` — interview session and question/evaluation services
- `src/modules/mcp/` — MCP server, tools, resources, and types
- `src/config/` — database, environment, model, upload, job, and skill configuration
- `src/middleware/` — request IDs, logging, and error handling
- `frontend/src/` — React pages, API clients, types, styling, and voice integration
- `postman/` — Postman collections for resume ingestion and retrieval APIs
- `01_Resume_Ingestion_Phasewise_Implementation 1 1.md` — ingestion implementation guide
- `02_Resume_Retrieval_Phasewise_Implementation.md` — retrieval implementation guide
- `mcp-markdown.md` — MCP design notes
- `interview-voice.md` — voice-interview design notes
- `PHASE1_ARCHITECTURE_AUDIT.md` — architecture review and staged job-work plan

## Topics covered

This project and its supporting documents cover:

- Retrieval-Augmented Generation (RAG)
- Resume parsing, PDF extraction, text cleaning, and structured data
- Embeddings and semantic search
- Vector databases and MongoDB Atlas Vector Search
- BM25 and lexical search
- Hybrid retrieval, candidate fusion, deduplication, filtering, and reranking
- Grounded generation, source attribution, and hallucination reduction
- Candidate evidence and job-description matching
- Job discovery, provider integration, ingestion, normalization, and deduplication
- Job applications, saved jobs, tailored CVs, and application messages
- Model Context Protocol (MCP), tools, resources, clients, and stdio transport
- LLM integration and prompt-driven generation/evaluation
- Interview question generation, answer evaluation, and voice interaction
- REST API design, frontend/backend integration, configuration, and automated testing

## Configuration

Copy `.env.example` to `.env` and set the values required for the features you intend to use. Common settings include:

- `PORT`, `NODE_ENV`
- `MONGODB_URI`, `MONGODB_DB_NAME`, resume collection settings
- `MISTRAL_API_KEY`, `MISTRAL_EMBED_MODEL`, `EMBEDDING_DIMENSION`
- `GROQ_API_KEY`, `GROQ_MODEL`
- Resume parser and upload-size settings
- Job roles, location, remote filter, provider credentials, collection and Atlas index names
- Job vector/keyword retrieval limits
- MCP server name and transport

The code's `src/config/env.ts` is authoritative for current defaults and variable names. Documentation templates may lag implementation. Never commit real API keys, database credentials, or private resume data.

## Running locally

Install root dependencies and run the backend:

```sh
npm install
npm run dev
```

In a second terminal, run the frontend:

```sh
cd frontend
npm install
npm run dev
```

Run the MCP server separately when connecting an MCP-compatible client:

```sh
npm run dev:mcp
```

Available root scripts include `npm run build`, `npm test`, and `npm start`. Frontend scripts include `npm run build`, `npm run lint`, and `npm run preview`.

## API and integration notes

- REST route groups are mounted by `src/app.ts` under `/v1`.
- Resume ingestion and retrieval are separate route groups over shared application data and MongoDB configuration.
- Job and interview route groups are also mounted by the API.
- Postman collections are provided for resume ingestion and retrieval.
- MCP runs as its own process and accesses the same configured database/services.
- Successful operation of live database indexes, model APIs, job providers, and browser speech depends on valid external configuration and service availability.

## Testing

Backend tests are run with:

```sh
npm test
```

The repository includes tests for ingestion, retrieval, jobs, and interview services. Frontend build and lint commands are defined in `frontend/package.json`. Tests and builds were not run while preparing this overview.

## Reference files

- `package.json` — backend scripts and dependencies
- `frontend/package.json` — frontend scripts and dependencies
- `src/config/env.ts` — active configuration defaults
- `src/app.ts` — API route registration and health endpoints
- `src/mcp-server.ts` — MCP process entry point
- `src/modules/mcp/server/resumeMcpServer.ts` — MCP server registration
- `frontend/README.md` — frontend local development notes
