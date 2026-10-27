import { createHash } from "node:crypto";

/**
 * Produces a deterministic jobId from a canonical source URL.
 *
 * The jobId is a 12-character hex prefix of the SHA-256 hash of the
 * lower-cased, trimmed URL.  Short enough to be readable in logs and
 * API responses while collision-resistant for practical use.
 */
export function buildJobId(url: string): string {
  const normalised = url.trim().toLowerCase();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 12);
}

/**
 * Produces a content hash from the normalised URL and cleaned description.
 *
 * The hash changes when the job content changes, enabling idempotent ingestion:
 * if the hash matches an existing document the ingestion can skip re-embedding.
 */
export function buildContentHash(url: string, cleanedText: string): string {
  const normalised = url.trim().toLowerCase();
  const content = cleanedText.trim().toLowerCase();
  return createHash("sha256")
    .update(`${normalised}\n${content}`)
    .digest("hex");
}
