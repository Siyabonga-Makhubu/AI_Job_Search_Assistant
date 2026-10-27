import { createHash } from "node:crypto";
import { env } from "../../../../config/env";
import type { Job, JobSearchCriteria, JobSearchResult } from "../../types/job.types";

type JSearchJob = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_description?: string;
  job_location?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_posted_at_timestamp?: number;
  job_employment_type?: string;
};

type JSearchResponse = { data?: JSearchJob[] };

/** Queries JSearch, which aggregates listings from Google for Jobs and the open web. */
export class JSearchProvider {
  async search(criteria: JobSearchCriteria): Promise<JobSearchResult[]> {
    const query = criteria.query?.trim();
    if (!query || query.length > 2000) {
      throw Object.assign(new Error("query must be 1 to 2000 characters"), { statusCode: 400, errorCode: "INVALID_QUERY" });
    }
    if (!env.jsearchApiKey) {
      throw Object.assign(new Error("Configure JSEARCH_API_KEY to enable multi-site job search"), { statusCode: 503, errorCode: "JOB_SEARCH_NOT_CONFIGURED" });
    }

    const location = criteria.location?.trim() || "South Africa";
    const url = new URL("https://api.openwebninja.com/jsearch/search-v2");
    const params = new URLSearchParams({
      query: `${query} jobs in ${location}`,
      country: "za",
      language: "en",
      page: "1",
      num_pages: "1",
    });
    if (criteria.remote === true) params.set("work_from_home", "true");
    url.search = params.toString();
    const response = await fetch(url, {
      headers: { Accept: "application/json", "x-api-key": env.jsearchApiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`JSearch returned HTTP ${response.status}`);
    const payload = await response.json() as JSearchResponse;
    const results: JobSearchResult[] = [];
    for (const item of payload.data ?? []) {
      if (!item.job_title || !item.job_apply_link) continue;
      let parsed: URL;
      try { parsed = new URL(item.job_apply_link); } catch { continue; }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      const description = (item.job_description ?? "").replace(/\s+/g, " ").trim().slice(0, 8000);
      const job: Job = {
        jobId: `external_${createHash("sha256").update(parsed.toString()).digest("hex").slice(0, 20)}`,
        external: true,
        title: item.job_title.replace(/\s+/g, " ").trim(),
        company: item.employer_name,
        location: item.job_location || location,
        remote: item.job_is_remote,
        source: { provider: "jsearch", site: item.job_publisher, url: parsed.toString() },
        description,
        responsibilities: [], requiredSkills: [], preferredSkills: [], technologies: [], qualifications: [],
        experienceRequirements: [], educationRequirements: [],
        employmentType: item.job_employment_type,
        publishedAt: item.job_posted_at_datetime_utc
          ? new Date(item.job_posted_at_datetime_utc)
          : item.job_posted_at_timestamp ? new Date(item.job_posted_at_timestamp * 1000) : undefined,
        discoveredAt: new Date(), rawText: description,
        contentHash: createHash("sha256").update(`${parsed.toString()}\n${description}`).digest("hex"),
      };
      results.push({ job });
    }
    return results;
  }
}
