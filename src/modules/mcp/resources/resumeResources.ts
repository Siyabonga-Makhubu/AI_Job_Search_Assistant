import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResumeRetrievalRepository } from "../../retrieval/repositories/ResumeRetrievalRepository";
import { normalizeResumeFields } from "../../ingestion/services/AlgorithmResumeParser";

/**
 * Registers MCP resources on the server.
 *
 * Resources are read-only data that an AI agent can inspect.
 * Unlike tools, they don't take action — they return structured
 * representations of existing data.
 *
 * Two resources are registered:
 *   resume://library          — lists all indexed candidates
 *   resume://candidate/{id}   — full structured detail for one candidate
 */
export function registerResumeResources(server: McpServer): void {
  // Resource: full candidate library listing
  server.resource(
    "resume-library",
    "resume://library",
    {
      description:
        "Returns a list of all indexed candidates with their name, role, company, skills, and experience. Use this to browse available candidates before running a targeted search.",
      mimeType: "application/json",
    },
    async () => {
      const repository = new ResumeRetrievalRepository();
      const resumes = await repository.listResumes();

      const candidates = resumes.map((resume) => {
        const fields = normalizeResumeFields(resume);
        return {
          resumeId: String(resume._id ?? ""),
          name: fields.name ?? resume.name ?? null,
          role: fields.role ?? resume.role ?? null,
          company: resume.company ?? null,
          skills: resume.skills ?? [],
          totalExperience: resume.totalExperience ?? null,
        };
      });

      return {
        contents: [
          {
            uri: "resume://library",
            mimeType: "application/json",
            text: JSON.stringify(
              { totalCandidates: candidates.length, candidates },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Resource template: single candidate by resumeId
  server.resource(
    "resume-candidate",
    "resume://candidate/{resumeId}",
    {
      description:
        "Returns full structured detail for one candidate identified by their resumeId. Includes name, role, company, skills, education, experience, and contact information.",
      mimeType: "application/json",
    },
    async (uri) => {
      // Extract the resumeId from the URI
      const resumeId = uri.href.replace("resume://candidate/", "");

      const repository = new ResumeRetrievalRepository();
      const resume = await repository.findById(resumeId);

      if (!resume) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                { error: "Candidate not found", resumeId },
                null,
                2
              ),
            },
          ],
        };
      }

      const fields = normalizeResumeFields(resume);

      const candidate = {
        resumeId,
        name: fields.name ?? resume.name ?? null,
        role: fields.role ?? resume.role ?? null,
        company: resume.company ?? null,
        email: fields.email ?? resume.email ?? null,
        phone: fields.phone ?? resume.phone ?? null,
        address: fields.address ?? resume.address ?? null,
        education: resume.education ?? null,
        totalExperience: resume.totalExperience ?? null,
        skills: resume.skills ?? [],
        experienceSummary: resume.experienceSummary ?? null,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(candidate, null, 2),
          },
        ],
      };
    }
  );
}
