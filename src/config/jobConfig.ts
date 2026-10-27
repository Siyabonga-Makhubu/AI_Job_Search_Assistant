import { env } from "./env";
import { jobSearchSources } from "../modules/jobs/discovery/services/FreeJobSearchProvider";

/**
 * Typed job-domain configuration.
 *
 * Reads from the shared env module so embedding/LLM settings are not
 * duplicated. Secrets (Mongo URI, API keys) are never included.
 */
export interface JobConfig {
  searchRoles: string[];
  searchLocation: string;
  searchRemote: boolean;
  searchProviderConfigured: boolean;
  searchSources: { name: string; label: string }[];
  collectionName: string;
  vectorIndexName: string;
  searchIndexName: string;
  vectorTopK: number;
  bm25TopK: number;
  matchTopK: number;
  applicationMessageModel: string;
}

export function getJobConfig(): JobConfig {
  const searchSources = [
    ...(env.adzunaAppId && env.adzunaAppKey ? jobSearchSources : []),
    ...(env.jsearchApiKey ? [{ name: "jsearch", label: "JSearch (LinkedIn, Indeed, and other sites)" }] : []),
    ...(env.linkedInJobsApiKey && env.linkedInJobsApiUrl ? [{ name: "linkedin-jobs", label: "LinkedIn Jobs API" }] : []),
  ];
  return {
    searchRoles: [...env.jobSearchRoles],
    searchLocation: env.jobSearchLocation,
    searchRemote: env.jobSearchRemote,
    searchProviderConfigured: Boolean((env.adzunaAppId && env.adzunaAppKey) || env.jsearchApiKey || (env.linkedInJobsApiKey && env.linkedInJobsApiUrl)),
    searchSources,
    collectionName: env.jobCollectionName,
    vectorIndexName: env.jobVectorIndexName,
    searchIndexName: env.jobSearchIndexName,
    vectorTopK: env.jobVectorTopK,
    bm25TopK: env.jobBm25TopK,
    matchTopK: env.jobMatchTopK,
    applicationMessageModel: env.groqModel,
  };
}
