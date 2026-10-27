# RAG Resume MCP Server

## 1. Purpose

This document defines an MCP (Model Context Protocol) server for the **RAG Resume Application**.

The MCP server provides an AI agent/LLM with structured, relevant and grounded information from:

* Candidate resume
* Skills
* Technical skills
* Soft skills
* Work experience
* Job titles
* Companies
* Employment history
* Projects
* Education
* Certifications
* Job descriptions
* Job requirements
* Candidate evidence
* Resume chunks
* Vector search results
* BM25/search results
* Hybrid retrieval results
* Candidate-job matching evidence

The objective is:

> Give the LLM the right information at the right time, rather than sending the entire resume and job description into the context window.

---

# 2. High-Level Architecture

```text
                         USER
                           |
                           | Natural-language request
                           v
                  +-------------------+
                  |    AI AGENT       |
                  |                   |
                  | Understands task  |
                  | Selects MCP tools  |
                  +---------+---------+
                            |
                            | MCP
                            v
                  +-------------------+
                  |   MCP CLIENT      |
                  |                   |
                  | Tool discovery    |
                  | Tool invocation    |
                  +---------+---------+
                            |
                            | MCP Protocol
                            v
                  +-------------------+
                  |   YOUR MCP SERVER |
                  |                   |
                  | Resume tools      |
                  | Job tools         |
                  | Retrieval tools   |
                  | Evidence tools    |
                  +---------+---------+
                            |
             +--------------+---------------+
             |                              |
             v                              v
      +-------------+                +-------------+
      | RAG Backend |                | MongoDB     |
      |             |                | Atlas       |
      | Retrieval   |                |             |
      | Embeddings  |                | Resume data |
      | BM25        |                | Job data    |
      | Hybrid      |                | Embeddings  |
      +-------------+                +-------------+
             |
             v
      Relevant evidence
             |
             v
        +----------+
        |   LLM    |
        |          |
        | Generate |
        | answer   |
        +----------+
```

---

# 3. Why Use MCP in the Resume RAG System?

A normal RAG pipeline might look like:

```text
User
 ↓
Query
 ↓
Retriever
 ↓
Relevant chunks
 ↓
LLM
 ↓
Answer
```

With MCP, the system becomes:

```text
User
 ↓
AI Agent
 ↓
MCP Client
 ↓
MCP Server
 ↓
RAG Retrieval Tools
 ↓
Relevant Evidence
 ↓
LLM
 ↓
Grounded Answer
```

The MCP server becomes a standardized interface between the AI agent and the RAG application.

Instead of the agent directly knowing how MongoDB, BM25, vector search or resume parsing works, it can use tools such as:

```text
search_resume
search_job_description
find_candidate_skills
find_relevant_experience
match_resume_to_job
get_candidate_evidence
retrieve_relevant_chunks
```

---

# 4. Important Design Principle

The MCP server should **not replace the RAG system**.

Instead:

```text
RAG = retrieval system

MCP = standardized interface to the retrieval system

LLM = reasoning/generation system

AI Agent = decides which tools to use
```

Therefore:

```text
MongoDB
   ↓
RAG Retrieval
   ↓
MCP Tools
   ↓
AI Agent
   ↓
LLM
```

---

# 5. What the MCP Server Should Know

The MCP server should expose information in several logical categories.

## 5.1 Candidate Information

```text
candidate_id
name
email
phone
location
linkedin
github
summary
```

---

## 5.2 Skills

```text
technical skills
programming languages
frameworks
databases
cloud technologies
AI technologies
machine learning
LLM technologies
RAG technologies
DevOps
testing
soft skills
```

Example:

```json
{
  "skill": "Python",
  "category": "Programming Language",
  "evidence": [
    "AI Engineering project",
    "RAG application"
  ],
  "years": null,
  "confidence": 0.94
}
```

---

# 6. Experience

Experience should contain structured information.

```json
{
  "company": "Example Company",
  "jobTitle": "AI Engineer",
  "startDate": "2025-01",
  "endDate": null,
  "responsibilities": [],
  "technologies": [],
  "achievements": [],
  "evidence": []
}
```

The MCP server should be able to retrieve:

```text
experience by company
experience by job title
experience by skill
experience by technology
experience by date
experience relevant to a job description
```

---

# 7. Projects

Projects should be searchable independently from employment history.

Example:

```json
{
  "projectName": "Resume RAG",
  "description": "...",
  "technologies": [
    "TypeScript",
    "Node.js",
    "Express",
    "MongoDB Atlas",
    "Mistral Embeddings",
    "Groq"
  ],
  "skills": [
    "RAG",
    "Vector Search",
    "BM25",
    "Hybrid Retrieval",
    "LLM Reranking"
  ],
  "evidence": []
}
```

---

# 8. Job Description

The MCP server should also understand the job be
