const TRACKING_PARAM = /^(utm_|fbclid|gclid|mc_|ref$|source$)/i;

const LINKEDIN_HOST = /(^|\.)linkedin\.com$/i;
const JOB_BOARD_HOST =
  /(^|\.)(greenhouse\.io|lever\.co|workable\.com|ashbyhq\.com|smartrecruiters\.com|recruitee\.com|indeed\.com)$/i;

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLinkedInUrl(url: string): boolean {
  try {
    return LINKEDIN_HOST.test(new URL(url.trim()).hostname);
  } catch {
    return /linkedin\.com/i.test(url);
  }
}

export function isJobBoardUrl(url: string): boolean {
  try {
    return JOB_BOARD_HOST.test(new URL(url.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * Canonical URL used as the job identity key.
 * Tracking query params and fragments are dropped so the same post
 * reached via different campaign links maps to one jobId.
 */
export function canonicalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith("manual:")) {
    return trimmed.toLowerCase();
  }

  const parsed = new URL(trimmed);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) {
      parsed.searchParams.delete(key);
    }
  }

  let href = parsed.toString();
  if (parsed.pathname !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1);
  }
  return href;
}
