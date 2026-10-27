import { cleanText } from "../utils/textCleaner";
import { JOB_TITLE_REGEX } from "../utils/regex";
import { SKILLS } from "../../../config/skills";

export interface ParsedResume {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  company?: string | null;
  role?: string | null;
  education?: string | null;
  totalExperience?: number | null;
  relevantExperience?: number | null;
  skills: string[];
  jobTitles?: string[];
  experienceSummary?: string | null;
}

export function detectSkills(rawText: string): string[] {
  const text = cleanText(rawText);
  const matches: string[] = [];

  for (const skill of [...SKILLS].sort((a, b) => b.length - a.length)) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    // Catalogue abbreviations such as R, AI, RAG, and SQL must match as whole
    // terms. Substring matching made ordinary words like "requirements" look
    // like the R programming language.
    const expression = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
    if (expression.test(text)) {
      matches.push(skill);
    }
  }

  return [...new Set(matches)];
}

function isContactValue(line: string): boolean {
  return Boolean(
    line.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i) ||
      line.match(/(?:\+?\d[\d\s().-]{7,}\d)/)
  );
}

/**
 * Isolates the street/address portion of a header line that also contains
 * email or phone (e.g. "17 Nkupane Street | name@email.com | 0767175041").
 */
function contactStrippedSegment(line: string): string {
  return line
    .split(/\s*(?:\||;|,)?\s*(?=\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d\s().-]{7,}\d))/i)[0]
    .trim();
}

function isAddressValue(line: string): boolean {
  const candidate = contactStrippedSegment(line);
  if (!candidate) {
    return false;
  }

  if (isContactValue(candidate)) {
    return false;
  }

  if (/^\d{4}\s*(?:-|\u2013|to)\s*(?:\d{4}|present|current|ongoing)$/i.test(candidate) || /^\d+(?:\.\d+)?\s*(?:years?|yrs?)\b/i.test(candidate)) {
    return false;
  }

  return /^(?:\d+\s+.+|.+\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|lane|ln\.?|boulevard|blvd\.?)\b)/i.test(candidate);
}

function isJobTitleValue(line: string): boolean {
  JOB_TITLE_REGEX.lastIndex = 0;
  return JOB_TITLE_REGEX.test(line);
}

// Common non-name words found in project titles, product names, and section headers.
// These look like person names to the word-pattern check but are never actual names.
const NON_NAME_WORDS = new Set([
  "system", "systems", "management", "platform", "portal", "application",
  "service", "services", "solution", "solutions", "project", "module",
  "engine", "framework", "library", "api", "sdk", "dashboard", "interface",
  "backend", "frontend", "database", "server", "client", "network",
  "infrastructure", "architecture", "design", "development", "integration",
  "automation", "analytics", "intelligence", "recognition", "detection",
  "processing", "monitoring", "tracking", "reporting", "overview",
  "profile", "objective", "declaration", "reference", "references",
  "certification", "certifications", "achievement", "achievements",
  "publication", "publications", "award", "awards", "interest", "interests",
  "hobby", "hobbies", "language", "languages", "technology", "technologies",
]);

function isLikelyPersonName(line: string): boolean {
  if (
    line.length < 3 ||
    line.length > 80 ||
    isContactValue(line) ||
    isAddressValue(line) ||
    isJobTitleValue(line) ||
    /https?:\/\/|www\.|\b(?:resume|curriculum vitae|skills|experience|education|contact|summary)\b/i.test(line)
  ) {
    return false;
  }

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) {
    return false;
  }

  if (!words.every((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word))) {
    return false;
  }

  // Reject lines that contain any known non-name word (case-insensitive).
  if (words.some((word) => NON_NAME_WORDS.has(word.toLowerCase()))) {
    return false;
  }

  return true;
}

function extractAddress(lines: string[]): string | null {
  const addressLine = lines.find((line) => isAddressValue(line));
  if (!addressLine) return null;

  return contactStrippedSegment(addressLine) || null;
}

function extractJobTitle(lines: string[]): string | null {
  const headerTitle = extractHeaderTitle(lines);
  if (headerTitle) {
    return headerTitle;
  }

  return lines.find((line) => {
    if (/^(?:executive|professional)?\s*summary$/i.test(line)) {
      return false;
    }

    return isJobTitleValue(line);
  }) ?? null;
}

function extractHeaderTitle(lines: string[]): string | null {
  const headerLine = lines.find((line) => /@/.test(line) || /linkedin\.com/i.test(line))
    ? lines[0]
    : null;

  if (!headerLine) {
    return null;
  }

  const match = headerLine.match(/^((?:[A-Za-z]\s+){3,}[A-Za-z])\s*(.+)$/);
  const title = match?.[2]?.trim();

  if (!title || /@|linkedin\.com|\d{5,}/i.test(title)) {
    return null;
  }

  return title;
}

function extractSpacedHeaderName(lines: string[], email: string | null): string | null {
  if (!email) {
    return null;
  }

  const headerLine = lines[0] ?? "";
  const match = headerLine.match(/^((?:[A-Za-z]\s+){3,}[A-Za-z])\s*(?:Marketing|Operations|Digital|Executive|Professional|Business|Sales|Human)\b/i);
  const emailName = email.split("@")[0].replace(/\d/g, "").replace(/[^A-Za-z]/g, "").toLowerCase();
  const headerName = match?.[1]?.replace(/\s/g, "").toLowerCase() ?? "";

  const linkedinName = lines.join(" ").match(/linkedin\.com\/in\/([a-z]+(?:-[a-z]+)+)/i)?.[1];
  if (linkedinName) {
    return linkedinName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  if (!emailName || !headerName.includes(emailName) || emailName.length < 6) {
    return null;
  }

  const splitAt = Math.max(2, Math.min(emailName.length - 2, Math.round(emailName.length * 0.4)));
  return `${emailName.slice(0, splitAt)} ${emailName.slice(splitAt)}`
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Extract the candidate name by looking near the contact info line (email/phone).
 * Names typically appear within a few lines of the contact details, even when
 * the header is in a different section of the document.
 */
function extractNameNearContact(lines: string[], email: string | null, phone: string | null): string | null {
  // Find the index of the line containing email or phone
  const contactIdx = lines.findIndex((line) => {
    if (email && line.includes(email)) return true;
    if (phone && line.replace(/\s/g, "").includes(phone.replace(/\s/g, ""))) return true;
    return false;
  });

  if (contactIdx === -1) {
    return null;
  }

  // Search up to 5 lines before and after the contact line
  const searchStart = Math.max(0, contactIdx - 5);
  const searchEnd = Math.min(lines.length - 1, contactIdx + 5);
  const candidates = lines.slice(searchStart, searchEnd + 1);

  return candidates.find((line) => isLikelyPersonName(line)) ?? null;
}

function extractCandidateName(lines: string[], role: string | null, address: string | null, email?: string | null, phone?: string | null): string | null {
  const labeledName = lines.find((line) => /^(?:name|candidate)\s*[:\-]/i.test(line));
  const labeledValue = labeledName?.replace(/^(?:name|candidate)\s*[:\-]\s*/i, "").trim();

  if (labeledValue && isLikelyPersonName(labeledValue)) {
    return labeledValue;
  }

  // Try to find the name near the contact info line first — this handles CVs
  // where the name appears at the bottom of a header section alongside the email/phone.
  const contactName = extractNameNearContact(lines, email ?? null, phone ?? null);
  if (contactName) {
    return contactName;
  }

  return (
    lines.find((line) => line !== role && line !== address && isLikelyPersonName(line)) ??
    null
  );
}

export function normalizeResumeFields(input: {
  rawText?: string | null;
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  location?: string | null;
}) {
  const lines = cleanText(input.rawText ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = lines.join(" ").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? input.email ?? null;
  const phone = lines.join(" ").match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? input.phone ?? null;
  const storedAddress = input.address?.split(/\s*\|\s*/)[0].trim() ?? null;
  const address = extractAddress(lines) ?? (storedAddress && isAddressValue(storedAddress) ? storedAddress : null);
  const role = extractJobTitle(lines) ?? (input.role && isJobTitleValue(input.role) ? input.role : null);
  const parsedName = extractCandidateName(lines, role, address, email, phone);
  const headerName = extractSpacedHeaderName(lines, email);
  const name = headerName ?? parsedName ?? (input.name && isLikelyPersonName(input.name) ? input.name : null);

  return { name, address, email, phone, role };
}

export function parseResume(rawText: string): ParsedResume {
  const text = cleanText(rawText ?? "");

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? null;
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? null;
  const address = extractAddress(lines);
  const role = extractJobTitle(lines);
  const name = extractSpacedHeaderName(lines, email) ?? extractCandidateName(lines, role, address, email, phone);

  const company =
    lines.find((line) => /(private limited|limited|inc\.?|llc|pvt|software solutions|technologies|labs)/i.test(line)) ?? null;

  const education =
    lines.find((line) => /(b\.tech|btech|m\.tech|be\b|b\.e\b|bachelor|master|diploma|information technology)/i.test(line)) ?? null;

  const experienceMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|yrs)/i);
  const totalExperience = experienceMatch ? Number.parseFloat(experienceMatch[1]) : null;

  const skills = detectSkills(text);
  const jobTitles = role ? [role] : [];
  const experienceSummary =
    lines.filter((line) => /(experience|worked|role|engineer|architect|qa|automation|genai|rag|llm|api|testing)/i.test(line)).slice(0, 3).join(" ") || null;

  return {
    name,
    address,
    email,
    phone,
    location: null,
    company,
    role,
    education,
    totalExperience,
    relevantExperience: null,
    skills,
    jobTitles: jobTitles.length ? jobTitles : undefined,
    experienceSummary
  };
}
