import type { JobSourceProvider } from "../types/discovery.types";
import type { RawJobPost, JobSearchCriteria } from "../../types/job.types";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * GenericWebProvider
 *
 * Fetches a publicly accessible job-post URL and returns its text content as
 * a RawJobPost.  This is the baseline provider that makes the ingest-by-URL
 * workflow work without any third-party API key.
 *
 * It does NOT:
 *   - Bypass authentication
 *   - Solve CAPTCHAs
 *   - Scrape behind login walls
 *
 * Phase 2 (job ingestion) will wire this provider into JobIngestionService.
 * For now the class is a typed stub so the module structure compiles cleanly.
 */
export class GenericWebProvider implements JobSourceProvider {
  readonly providerName = "web";

  // searchJobs is not meaningful for the generic provider — it only supports
  // direct URL ingestion.
  async searchJobs(_criteria: JobSearchCriteria): Promise<RawJobPost[]> {
    throw Object.assign(
      new Error("GenericWebProvider does not support job search — provide a direct URL"),
      { errorCode: "UNSUPPORTED_JOB_SOURCE" }
    );
  }

  async getJob(url: string): Promise<RawJobPost> {
    const page = await this.fetchPublicPage(url, 0);
    const contentType = page.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw Object.assign(new Error("Job source must return HTML or plain text"), { statusCode: 415, errorCode: "UNSUPPORTED_JOB_SOURCE" });
    }
    const html = await page.text();
    if (html.length > 2_000_000) throw Object.assign(new Error("Job page exceeds the 2 MB limit"), { statusCode: 413, errorCode: "JOB_PAGE_TOO_LARGE" });
    const meta = (key: string) => {
      const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"));
      return match?.[1]?.replace(/&amp;/g, "&").trim();
    };
    const title = meta("og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const description = meta("og:description") ?? "";
    const text = html
      .replace(/<(script|style|noscript|svg|header|footer|nav|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_all, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([\da-f]+);/gi, (_all, n: string) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    const rawText = [title, description, text].filter(Boolean).join("\n");
    if (!rawText) throw Object.assign(new Error("No job description text could be extracted from the page"), { statusCode: 422, errorCode: "JOB_EXTRACTION_FAILED" });
    return { url: page.url, title, rawText, provider: "web" };
  }

  private async fetchPublicPage(input: string, redirects: number): Promise<Response> {
    let target: URL;
    try { target = new URL(input); } catch { throw Object.assign(new Error("A valid public job URL is required"), { statusCode: 400, errorCode: "INVALID_JOB_URL" }); }
    if (target.protocol !== "https:" && target.protocol !== "http:") throw Object.assign(new Error("Only HTTP and HTTPS job URLs are supported"), { statusCode: 400, errorCode: "INVALID_JOB_URL" });
    if (target.username || target.password || this.isBlockedHost(target.hostname)) throw Object.assign(new Error("Private or credentialed URLs are not allowed"), { statusCode: 400, errorCode: "INVALID_JOB_URL" });
    try {
      const addresses = isIP(target.hostname) ? [{ address: target.hostname }] : await lookup(target.hostname, { all: true });
      if (!addresses.length || addresses.some(({ address }) => this.isPrivateIp(address))) throw new Error("private address");
    } catch {
      throw Object.assign(new Error("Job URL host is unavailable or resolves to a private network"), { statusCode: 400, errorCode: "INVALID_JOB_URL" });
    }
    const response = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "ResumeRAG-JobIngest/1.0" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects >= 4) throw Object.assign(new Error("Too many redirects while retrieving job page"), { statusCode: 422, errorCode: "JOB_FETCH_FAILED" });
      const location = response.headers.get("location");
      if (!location) throw Object.assign(new Error("Job page redirect did not include a destination"), { statusCode: 422, errorCode: "JOB_FETCH_FAILED" });
      return this.fetchPublicPage(new URL(location, target).toString(), redirects + 1);
    }
    if (!response.ok) throw Object.assign(new Error(`Job source returned HTTP ${response.status}`), { statusCode: 422, errorCode: "JOB_FETCH_FAILED" });
    return response;
  }

  private isBlockedHost(host: string): boolean {
    const name = host.toLowerCase().replace(/^\[|\]$/g, "");
    return name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal");
  }

  private isPrivateIp(address: string): boolean {
    const normalized = address.toLowerCase();
    if (isIP(address) === 6) return true;
    if (isIP(address) !== 4) return false;
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
}
