/**
 * jobCleaner
 *
 * Cleans raw job-post text before parsing and embedding.
 *
 * Removes:
 *   - HTML tags and attributes
 *   - Navigation boilerplate (Apply / Back / Share / Save buttons)
 *   - Cookie notices and GDPR banners
 *   - Script / style block remnants
 *   - Duplicate whitespace and excessive blank lines
 *   - URL-only lines (tracking pixels, redirect links)
 *
 * Preserves:
 *   - Technical terminology (RAG, LLM, LangChain, MongoDB Atlas, Python, etc.)
 *   - Structured sections (Responsibilities, Requirements, About the role)
 *   - Bullet-point content
 */
export function cleanJobText(rawText: string): string {
  if (!rawText) return "";

  return rawText
    // Normalise line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    // Strip HTML tags (fallback for partially-parsed HTML)
    .replace(/<[^>]+>/g, " ")

    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, " ")

    // Remove lines that are purely navigation / UI artefacts
    .replace(
      /^.*(apply now|save job|share job|back to results|cookie notice|we use cookies|privacy policy|terms of service|sign in to apply|create an alert).+$/gim,
      ""
    )

    // Remove bare URLs
    .replace(/https?:\/\/\S+/g, "")

    // Remove null bytes and non-printable control characters
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

    // Collapse tabs and non-newline whitespace
    .replace(/[ \t\f]+/g, " ")

    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")

    // Collapse runs of 3+ blank lines down to a single blank line
    .replace(/\n{3,}/g, "\n\n")

    .trim();
}
