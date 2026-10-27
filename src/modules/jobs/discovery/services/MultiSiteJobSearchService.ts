import { FreeJobSearchProvider } from "./FreeJobSearchProvider";
import { JSearchProvider } from "./JSearchProvider";
import type { JobSearchCriteria, JobSearchResult } from "../../types/job.types";

/** Searches independent job indexes concurrently and tolerates one source being unavailable. */
export class MultiSiteJobSearchService {
  constructor(
    private readonly adzuna = new FreeJobSearchProvider(),
    private readonly jsearch = new JSearchProvider(),
  ) {}

  async search(criteria: JobSearchCriteria): Promise<JobSearchResult[]> {
    const providers = [
      { name: "adzuna", search: () => this.adzuna.search(criteria) },
      { name: "jsearch", search: () => this.jsearch.search(criteria) },
    ].filter(({ name }) => !criteria.source || criteria.source === "all" || criteria.source === name);

    const responses = await Promise.allSettled(providers.map(({ search }) => search()));
    const successful = responses.filter((result): result is PromiseFulfilledResult<JobSearchResult[]> => result.status === "fulfilled");
    if (!successful.length) {
      const configuredError = responses.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
      if (configuredError?.errorCode === "JOB_SEARCH_NOT_CONFIGURED") throw configuredError;
      throw Object.assign(new Error("All configured job search providers are unavailable"), { statusCode: 502, errorCode: "JOB_SEARCH_FAILED" });
    }

    // De-duplicate cross-posts by destination URL, keeping the first source result.
    const unique = new Map<string, JobSearchResult>();
    const providerResults = successful.map((response) => response.value);
    const longest = Math.max(0, ...providerResults.map((items) => items.length));
    for (let index = 0; index < longest; index++) {
      for (const items of providerResults) {
        const result = items[index];
        if (!result) continue;
        const key = result.job.source.url.toLowerCase().replace(/[?#].*$/, "");
        if (!unique.has(key)) unique.set(key, result);
      }
    }
    return [...unique.values()].slice(0, Math.max(1, Math.min(50, criteria.topK ?? 10)));
  }
}
