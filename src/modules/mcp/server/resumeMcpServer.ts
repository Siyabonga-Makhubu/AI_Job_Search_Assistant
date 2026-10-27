import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { registerResumeResources } from "../resources/resumeResources";

import { searchResumesSchema, searchResumesTool } from "../tools/searchResumes.tool";
import { getCandidateSchema, getCandidateTool } from "../tools/getCandidate.tool";
import { getCandidateSkillsSchema, getCandidateSkillsTool } from "../tools/getCandidateSkills.tool";
import { getCandidateExperienceSchema, getCandidateExperienceTool } from "../tools/getCandidateExperience.tool";
import { getCandidateEducationSchema, getCandidateEducationTool } from "../tools/getCandidateEducation.tool";
import { getCandidateCompaniesSchema, getCandidateCompaniesTool } from "../tools/getCandidateCompanies.tool";
import { matchJobDescriptionSchema, matchJobDescriptionTool } from "../tools/matchJobDescription.tool";
import { getResumeEvidenceSchema, getResumeEvidenceTool } from "../tools/getResumeEvidence.tool";
import { findDuplicateResumesSchema, findDuplicateResumesTool } from "../tools/findDuplicateResumes.tool";
import { deleteDuplicateResumesSchema, deleteDuplicateResumesTool } from "../tools/deleteDuplicateResumes.tool";

/**
 * Builds and returns the configured Resume RAG MCP server.
 *
 * This server exposes existing Resume RAG capabilities as MCP tools
 * and resources. It does NOT replace the Express API — it is an
 * additional interface for AI agents (Kiro, VS Code, Claude Desktop, etc.)
 *
 * Tools registered:
 *   search_resumes         — hybrid RAG retrieval by natural-language query
 *   get_candidate          — full structured profile for a specific candidate
 *   get_candidate_skills   — skills list for a specific candidate
 *   get_candidate_experience — experience details for a specific candidate
 *   get_candidate_education  — education details for a specific candidate
 *   get_candidate_companies  — company history for a specific candidate
 *   match_job_description  — rank candidates against a job description
 *   get_resume_evidence    — retrieve evidence for a candidate vs. a query
 *   find_duplicate_resumes — preview duplicate CV groups in the database (read-only)
 *   delete_duplicate_resumes — permanently delete duplicate CVs, keeping the newest per group
 *
 * Resources registered:
 *   resume://library            — browse all indexed candidates
 *   resume://candidate/{id}     — full profile for one candidate
 */
export function createResumeMcpServer(): McpServer {
  const server = new McpServer({
    name: "resume-rag-mcp",
    version: "1.0.0",
  });

  // ── Resources ────────────────────────────────────────────────────────────
  registerResumeResources(server);

  // ── Tool: search_resumes ─────────────────────────────────────────────────
  server.tool(
    "search_resumes",
    "Search the resume library using the existing hybrid RAG pipeline (vector + BM25 + reranking). " +
      "Provide a natural-language query and optionally specify the number of results and retrieval mode.",
    searchResumesSchema,
    async (args) => {
      try {
        const result = await searchResumesTool(args as Parameters<typeof searchResumesTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: get_candidate ──────────────────────────────────────────────────
  server.tool(
    "get_candidate",
    "Retrieve full structured information about a specific candidate using their resumeId. " +
      "Returns name, role, company, contact details, education, experience, and skills.",
    getCandidateSchema,
    async (args) => {
      try {
        const result = await getCandidateTool(args as Parameters<typeof getCandidateTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: get_candidate_skills ───────────────────────────────────────────
  server.tool(
    "get_candidate_skills",
    "Retrieve the detected skills list for a specific candidate. " +
      "Returns all skills extracted from the resume during ingestion.",
    getCandidateSkillsSchema,
    async (args) => {
      try {
        const result = await getCandidateSkillsTool(args as Parameters<typeof getCandidateSkillsTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: get_candidate_experience ──────────────────────────────────────
  server.tool(
    "get_candidate_experience",
    "Retrieve the work experience details for a specific candidate. " +
      "Returns total years of experience, current role, company, and an experience summary.",
    getCandidateExperienceSchema,
    async (args) => {
      try {
        const result = await getCandidateExperienceTool(args as Parameters<typeof getCandidateExperienceTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: get_candidate_education ───────────────────────────────────────
  server.tool(
    "get_candidate_education",
    "Retrieve the education details for a specific candidate. " +
      "Returns the highest degree or qualification extracted from the resume.",
    getCandidateEducationSchema,
    async (args) => {
      try {
        const result = await getCandidateEducationTool(args as Parameters<typeof getCandidateEducationTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: get_candidate_companies ───────────────────────────────────────
  server.tool(
    "get_candidate_companies",
    "Retrieve the company/employer information for a specific candidate. " +
      "Returns the most recent company extracted from the resume.",
    getCandidateCompaniesSchema,
    async (args) => {
      try {
        const result = await getCandidateCompaniesTool(args as Parameters<typeof getCandidateCompaniesTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: match_job_description ──────────────────────────────────────────
  server.tool(
    "match_job_description",
    "Match candidates from the resume library against a job description. " +
      "Extracts required skills from the job description and ranks candidates by skill match percentage and rerank score. " +
      "Returns matched and missing requirements per candidate.",
    matchJobDescriptionSchema,
    async (args) => {
      try {
        const result = await matchJobDescriptionTool(args as Parameters<typeof matchJobDescriptionTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: get_resume_evidence ────────────────────────────────────────────
  server.tool(
    "get_resume_evidence",
    "Retrieve the evidence a specific candidate has for a given query or requirement. " +
      "Runs the full hybrid retrieval pipeline and extracts evidence for the specified candidate. " +
      "Useful for grounding answers about why a candidate is relevant.",
    getResumeEvidenceSchema,
    async (args) => {
      try {
        const result = await getResumeEvidenceTool(args as Parameters<typeof getResumeEvidenceTool>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: find_duplicate_resumes ────────────────────────────────────────
  server.tool(
    "find_duplicate_resumes",
    "Scan the MongoDB resume collection and identify duplicate CV documents. " +
      "Groups duplicates by email address (highest priority), then by candidate name + experience, " +
      "then by file name. Returns a preview of which documents would be deleted and which would be kept " +
      "(always the most recently ingested copy). This is READ-ONLY — nothing is deleted. " +
      "Call delete_duplicate_resumes to act on the result.",
    findDuplicateResumesSchema,
    async (_args) => {
      try {
        const result = await findDuplicateResumesTool();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  // ── Tool: delete_duplicate_resumes ───────────────────────────────────────
  server.tool(
    "delete_duplicate_resumes",
    "Permanently delete duplicate CV documents from MongoDB. " +
      "For each duplicate group the most recently ingested document is KEPT and all older copies are DELETED. " +
      "This operation is IRREVERSIBLE. Always call find_duplicate_resumes first to preview the groups. " +
      "Pass { confirm: true } to proceed.",
    deleteDuplicateResumesSchema,
    async (args) => {
      try {
        const result = await deleteDuplicateResumesTool(args as { confirm: true });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
      }
    }
  );

  return server;
}
