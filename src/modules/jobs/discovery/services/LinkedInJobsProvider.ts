import { env } from "../../../../config/env";
import type { JobSourceProvider } from "../types/discovery.types";
import type { JobSearchCriteria, RawJobPost } from "../../types/job.types";

type ApiJob = Record<string, unknown>;
type ApiPayload = { jobs?: ApiJob[]; results?: ApiJob[]; data?: ApiJob[] };

const asText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

/** Uses a configured third-party LinkedIn jobs API; it never accesses LinkedIn directly. */
export class LinkedInJobsProvider implements JobSourceProvider {
  readonly providerName = "linkedin-jobs";

  async searchJobs(criteria: JobSearchCriteria): Promise<RawJobPost[]> {
    if (!env.linkedInJobsApiKey || !env.linkedInJobsApiUrl) {
      throw Object.assign(new Error("LinkedIn Jobs API is not configured"), { errorCode: "JOB_SEARCH_NOT_CONFIGURED" });
    }
    const endpoint = new URL(env.linkedInJobsApiUrl);
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") throw new Error("LinkedIn Jobs API URL must use HTTP or HTTPS");
    const location = criteria.location?.trim() || env.jobSearchLocation || "South Africa";
    endpoint.searchParams.set("query", `${criteria.query} jobs`);
    endpoint.searchParams.set("location", location);
    endpoint.searchParams.set("country", "South Africa");
    endpoint.searchParams.set("limit", String(Math.max(1, Math.min(50, criteria.topK ?? 10))));
    if (criteria.remote !== undefined) endpoint.searchParams.set("remote", String(criteria.remote));

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "x-api-key": env.linkedInJobsApiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`LinkedIn Jobs API returned HTTP ${response.status}`);
    const payload = await response.json() as ApiPayload | ApiJob[];
    const items = Array.isArray(payload) ? payload : payload.jobs ?? payload.results ?? payload.data ?? [];
    const results: RawJobPost[] = [];
    for (const item of items) {
      const url = asText(item.url, item.job_url, item.jobUrl, item.linkedin_url, item.job_apply_link, item.apply_url);
      const title = asText(item.title, item.job_title, item.jobTitle, item.position);
      if (!url || !title) continue;
      let parsed: URL;
      try { parsed = new URL(url); } catch { continue; }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      const id = asText(item.id, item.job_id, item.jobId);
      const description = asText(item.description, item.job_description, item.snippet) ?? "";
      const locationValue = item.location;
      const locationText = typeof locationValue === "object" && locationValue !== null
        ? asText((locationValue as Record<string, unknown>).name, (locationValue as Record<string, unknown>).display_name)
        : asText(locationValue, item.job_location);
      const companyValue = item.company;
      const company = typeof companyValue === "object" && companyValue !== null
        ? asText((companyValue as Record<string, unknown>).name, (companyValue as Record<string, unknown>).display_name)
        : asText(companyValue, item.company_name, item.employer_name);
      results.push({
        url: parsed.toString(), title, company, location: locationText ?? location,
        rawText: description,
        publishedAt: (() => { const date = asText(item.publishedAt, item.published_at, item.posted_at, item.date); return date && !Number.isNaN(new Date(date).getTime()) ? new Date(date) : undefined; })(),
        provider: this.providerName,
        externalId: id,
      });
    }
    return results;
  }

  async getJob(url: string): Promise<RawJobPost> {
    throw new Error(`Fetching a discovered listing is not supported by LinkedIn Jobs API: ${url}`);
  }
}
