# AI Job Search Assistant

A full-stack job-search and career-preparation platform built around a Resume Retrieval-Augmented Generation (RAG) backend. The project helps users ingest resumes, search and reason over resume evidence, discover jobs, match candidates to opportunities, prepare application materials, and practice interviews.

## Overview

This repository combines:

- A Node.js + TypeScript backend API for resume ingestion, retrieval, job matching, and interview workflows
- A React + TypeScript frontend for job search, saved jobs, analysis, and interview practice
- MongoDB-backed persistence with Atlas vector search and BM25 search support
- Optional LLM-powered parsing, reranking, and grounded answer generation
- An MCP server exposing resume and candidate tools to compatible AI clients

The system is designed to support an end-to-end workflow from uploading a CV to evaluating job-fit and preparing for interviews.

## Core capabilities

### Resume ingestion and parsing
- Upload resume PDFs
- Extract text from uploaded files
- Clean and normalize resume content
- Parse structured sections such as skills, experience, education, and contact details
- Generate embeddings for resume content
- Store resume data and evidence in MongoDB

### Resume RAG and evidence retrieval
- Search across stored resume data using semantic vector retrieval
- Combine with lexical BM25 matching
- Filter results by metadata
- Deduplicate and re-rank retrieved evidence
- Produce grounded answers with source-aware context

### Job discovery and matching
- Discover jobs from configured external providers
- Ingest and normalize job data
- Store job documents in MongoDB
- Match jobs to candidate profiles using resume evidence
- Generate job-fit analysis and application support

### Application and AI assistance
- Tailor application messages
- Generate candidate evidence for job application tasks
- Support application workflow utilities and job evaluation APIs

### Interview preparation
- Start interview sessions
- Generate interview questions
- Evaluate answers and track topics
- Produce follow-up questions and final feedback

### Model Context Protocol (MCP)
- Expose read-only resume resources and tools through an MCP server
- Support external AI clients that integrate with the standard MCP protocol

## Architecture

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

## Tech stack

### Backend
- Node.js
- TypeScript
- Express 5
- MongoDB Node.js driver
- Mistral embeddings and LLM access
- Groq integration through LangChain
- Zod validation
- Multer for PDF uploads
- `pdf-parse` for document extraction
- `@modelcontextprotocol/sdk` for MCP

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Recharts
- Lucide icons

### Search and retrieval
- MongoDB Atlas Vector Search
- BM25 keyword search
- Hybrid retrieval and ranking
- Metadata filtering and deduplication

## Repository structure

```text
.
├── .env.example                  # Environment variable template
├── package.json                  # Backend scripts and dependencies
├── src/                          # Express server, config, and app modules
│   ├── config/                  # env, DB, model, and app configuration
│   ├── middleware/              # request logging and error handling
│   ├── modules/
│   │   ├── ingestion/           # resume upload, parsing, embeddings, storage
│   │   ├── retrieval/           # semantic/BM25 retrieval and RAG logic
│   │   ├── jobs/                # job discovery, matching, evaluation, applications
│   │   ├── interview/           # interview flows and evaluation
│   │   └── mcp/                # MCP tools/resources/server
│   ├── app.ts                   # Express app definition
│   ├── server.ts                # API startup entry point
│   └── mcp-server.ts            # MCP server startup entry point
├── frontend/                    # React frontend app
├── evaluation/                  # Python-based eval scripts and tests
├── scripts/                     # Helper scripts
├── postman/                     # API testing collections
├── tests/                      # Playwright/API tests
├── uploads/                    # Runtime upload storage
├── 01_Resume_Ingestion_Phasewise_Implementation 1 1.md
├── 02_Resume_Retrieval_Phasewise_Implementation.md
├── Job-search-project.md
├── PHASE1_ARCHITECTURE_AUDIT.md
├── interview-voice.md
├── mcp-markdown.md
└── README.md
```

## Prerequisites

Before running the project locally, make sure you have:

- Node.js 18+ or current LTS version
- npm
- MongoDB Atlas or a MongoDB instance accessible from the app
- API keys for:
  - Mistral
  - Groq
- Optional external job provider credentials if job discovery is enabled

## Environment setup

1. Copy `.env.example` to `.env`.
2. Fill in your database and API keys.
3. Configure MongoDB connection variables, collection names, model names, and job-search settings.

Example values are included in `.env.example` and should be adapted to your environment.

## Quick start

### 1) Install backend dependencies

```bash
npm install
```

### 2) Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 3) Start the backend API

```bash
npm run dev
```

This starts the Express API and exposes routes under `/v1`.

### 4) Start the frontend

```bash
cd frontend
npm run dev
```

The frontend is served by Vite and typically runs on port `4173`.

### 5) Optional: start the MCP server

```bash
npm run dev:mcp
```

The MCP server is a separate process using stdio transport.

## Useful commands

### Root project

```bash
npm run dev
npm run dev:mcp
npm run build
npm run start
npm test
npm run test:e2e
npm run test:api
npm run test:smoke
npm run test:all
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

## Health and API checks

The backend exposes health endpoints:

- `GET /v1/health`
- `GET /v1/health/db`

These can be used to verify the app is running and the MongoDB connection is healthy.

## Feature notes

- The project uses environment variables from `.env` and does not hardcode secrets in source files.
- DeepEval-powered evaluations are optional and may consume LLM API quota.
- Job discovery and vector-search behavior depend on configured Atlas indexes and search settings.
- Some features require valid external credentials and services to be available.

## Documentation

This repository includes implementation notes and design documents that describe the project in more detail:

- `Job-search-project.md` — high-level project overview
- `PHASE1_ARCHITECTURE_AUDIT.md` — architecture review and planning notes
- `01_Resume_Ingestion_Phasewise_Implementation 1 1.md` — resume ingestion design
- `02_Resume_Retrieval_Phasewise_Implementation.md` — retrieval workflow details
- `mcp-markdown.md` — MCP documentation and design notes
- `interview-voice.md` — interview voice integration notes
- `src/modules/retrieval/README.md` — retrieval module overview
- `frontend/README.md` — frontend-specific instructions

## License

The project currently declares the ISC license in the root package configuration.

## Notes

This app is intended as a practical AI-assisted career tool. Some capabilities depend on external services, model access, and search infrastructure being configured correctly. The source code is the most current reference for exact behavior and available routes.
