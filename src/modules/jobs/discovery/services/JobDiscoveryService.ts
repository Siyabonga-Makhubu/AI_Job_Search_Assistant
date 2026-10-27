import { env } from "../../../../config/env";
import { canonicalizeUrl } from "../../ingestion/utils/jobUrl";
import type { JobSourceProvider } from "../types/discovery.types";
import type { RawJobPost, JobSearchCriteria } from "../../types/job.types";

export class JobDiscoveryService {
  constructor(private readonly providers: JobSourceProvider[] = []) {}

  async discoverJobs(overrideCriteria?: Partial<JobSearchCriteria>): Promise<RawJobPost[]> {
    if (!this.providers.length) throw Object.assign(
      new Error("No supported job search provider is configured. You can ingest a public job URL directly."),
      { statusCode: 503, errorCode: "JOB_DISCOVERY_UNAVAILABLE" },
    );
    const roles = overrideCriteria?.query ? [overrideCriteria.query] : env.jobSearchRoles;
    const all: RawJobPost[] = [];
    let successfulProviders = 0;
    for (const query of roles) {
      const criteria: JobSearchCriteria = {
        query,
        location: overrideCriteria?.location ?? env.jobSearchLocation,
        remote: overrideCriteria?.remote ?? env.jobSearchRemote,
        topK: Math.min(50, Math.max(1, overrideCriteria?.topK ?? 10)),
        mode: overrideCriteria?.mode ?? "hybrid",
      };
      for (const provider of this.providers) {
        try {
          const results = await provider.searchJobs(criteria);
          successfulProviders++;
          all.push(...results);
          console.info(JSON.stringify({ event: "job_discovery_completed", provider: provider.providerName, query, resultCount: results.length }));
        } catch (error) {
          console.warn(JSON.stringify({
            event: "job_discovery_provider_failed",
            provider: provider.providerName,
            query,
            error: error instanceof Error ? error.message : "Unknown provider error",
          }));
        }
      }
    }
    if (!successfulProviders) throw Object.assign(new Error("Configured job discovery providers could not return results"), { statusCode: 502, errorCode: "JOB_DISCOVERY_FAILED" });
    const unique = new Map<string, RawJobPost>();
    for (const post of all) {
      try {
        const canonical = canonicalizeUrl(post.url);
        const keys = [canonical, ...(post.externalId ? [`provider-id:${post.provider}:${post.externalId}`] : [])];
        if (keys.some((key) => unique.has(key))) continue;
        for (const key of keys) unique.set(key, post);
      } catch { /* Ignore malformed provider records. */ }
    }
    return [...new Set(unique.values())];
  }
}
