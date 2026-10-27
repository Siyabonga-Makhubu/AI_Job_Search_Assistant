import { createHash } from "node:crypto";
import { env } from "../../../../config/env";
import type { Job, JobSearchCriteria, JobSearchResult } from "../../types/job.types";
import { JobParsingService } from "../../parsing/services/JobParsingService";

type AdzunaJob = {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
};
type AdzunaResponse = { results?: AdzunaJob[] };

/** Searches Adzuna's South African listings (country code ZA). */
export class FreeJobSearchProvider {
  private readonly jobParser = new JobParsingService();

  async search(criteria: JobSearchCriteria): Promise<JobSearchResult[]> {
    const query = criteria.query?.trim();
    if (!query || query.length > 2000) {
      throw Object.assign(new Error("query must be 1 to 2000 characters"), { statusCode: 400, errorCode: "INVALID_QUERY" });
    }
    if (!env.adzunaAppId || !env.adzunaAppKey) {
      throw Object.assign(new Error("Configure ADZUNA_APP_ID and ADZUNA_APP_KEY to search South African jobs"), { statusCode: 503, errorCode: "JOB_SEARCH_NOT_CONFIGURED" });
    }

    const topK = Math.max(1, Math.min(20, Math.floor(criteria.topK ?? 10)));
    const url = new URL("https://api.adzuna.com/v1/api/jobs/za/search/1");
    url.search = new URLSearchParams({
      app_id: env.adzunaAppId,
      app_key: env.adzunaAppKey,
      results_per_page: String(topK),
      what: query,
      where: criteria.location?.trim() || "South Africa",
      "content-type": "application/json",
    }).toString();
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Adzuna returned HTTP ${response.status}`);
    const payload = await response.json() as AdzunaResponse;
    const results: JobSearchResult[] = [];
    for (const item of payload.results ?? []) {
      if (!item.title || !item.redirect_url) continue;
      let parsed: URL;
      try { parsed = new URL(item.redirect_url); } catch { continue; }
      if (parsed.protocol !== "https:") continue;
      const description = (item.description ?? "").replace(/\s+/g, " ").trim().slice(0, 4000);
      const location = item.location?.display_name ?? item.location?.area?.join(", ");
      const publishedAt = item.created ? new Date(item.created) : undefined;
      const parsedJob = this.jobParser.parse({
        cleanedText: description,
        rawTitle: item.title.replace(/\s+/g, " ").trim(),
        rawCompany: item.company?.display_name,
        rawLocation: location,
      });
      const job: Job = {
        jobId: `external_${createHash("sha256").update(parsed.toString()).digest("hex").slice(0, 20)}`,
        external: true,
        title: item.title.replace(/\s+/g, " ").trim(),
        company: item.company?.display_name,
        location,
        remote: parsedJob.remote || /remote/i.test(`${location ?? ""} ${description}`),
        employmentType: parsedJob.employmentType,
        source: { provider: "adzuna", url: parsed.toString() },
        description,
        responsibilities: parsedJob.responsibilities,
        requiredSkills: parsedJob.requiredSkills,
        preferredSkills: parsedJob.preferredSkills,
        technologies: parsedJob.technologies,
        qualifications: parsedJob.qualifications,
        experienceRequirements: parsedJob.experienceRequirements,
        educationRequirements: parsedJob.educationRequirements,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        discoveredAt: new Date(), rawText: description,
        contentHash: createHash("sha256").update(`${parsed.toString()}\n${description}`).digest("hex"),
      };
      results.push({ job });
    }
    return results;
  }
}

export const jobSearchSources = [{ name: "adzuna", label: "Adzuna South Africa" }];
