import { ResumeRetrievalRepository } from "../../../retrieval/repositories/ResumeRetrievalRepository";
import { detectSkills } from "../../../ingestion/services/AlgorithmResumeParser";
import type { CandidateEvidence } from "../../types/job.types";
import type { StoredResume } from "../../../retrieval/types/retrieval.types";

const STOP_WORDS = new Set(["and", "the", "with", "for", "from", "years", "year", "experience", "using", "ability", "knowledge", "skills", "skill", "required", "preferred", "strong", "good", "have", "has"]);

export class CandidateEvidenceService {
  constructor(private readonly repository = new ResumeRetrievalRepository()) {}

  async findEvidenceForRequirement(requirement: string, candidateId?: string, profileOverride?: StoredResume | null): Promise<CandidateEvidence[]> {
    const profile = profileOverride === undefined ? await this.getCandidateProfile(candidateId) : profileOverride;
    if (!profile || !requirement.trim()) return [];
    const query = requirement.toLowerCase();
    const tokens = [...new Set(query.match(/[a-z0-9+#.]+/g) ?? [])].filter((token) => token.length > 1 && !STOP_WORDS.has(token));
    const evidence: CandidateEvidence[] = [];
    for (const skill of profile.skills ?? []) {
      if (this.containsPhrase(query, skill) || this.containsPhrase(skill.toLowerCase(), query)) {
        evidence.push({ source: "skill", name: skill, technology: skill, text: `Resume skills list includes ${skill}.` });
      }
    }
    // Structured resume fields are authoritative evidence too. Keep their text
    // tied to the stored profile rather than asking a model to infer it.
    for (const [source, value] of [["experience", profile.experienceSummary], ["education", profile.education]] as const) {
      if (typeof value !== "string" || !value.trim()) continue;
      const matches = tokens.filter((token) => this.containsPhrase(value, token));
      if (matches.length) evidence.push({ source, text: value.trim(), technology: matches[0] });
    }
    const rawText = profile.rawText ?? "";
    const fragments = rawText
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((text) => text.replace(/^\s*[-•*]\s*/, "").trim())
      .filter((text) => text.length >= 15 && text.length <= 600);
    const used = new Set<string>();
    for (const fragment of fragments) {
      const matches = tokens.filter((token) => this.containsPhrase(fragment, token));
      if (matches.length === 0) continue;
      const section = this.currentSection(rawText, fragment);
      const source = /project/i.test(section) ? "project" : /experience|employment|work history/i.test(section) ? "experience" : /education|qualification/i.test(section) ? "education" : "resume_text";
      const key = fragment.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      evidence.push({ source, name: section || undefined, text: fragment, technology: matches[0] });
    }
    // Keep exact/phrase skill evidence first, then retain the strongest text
    // matches. This prevents an early generic mention in the CV from hiding
    // a later, directly relevant project or experience entry.
    const score = (item: CandidateEvidence) => {
      const text = `${item.name ?? ""} ${item.technology ?? ""} ${item.text}`;
      const matchedTokens = tokens.filter((token) => this.containsPhrase(text, token)).length;
      return (item.source === "skill" ? 100 : item.source === "project" ? 20 : item.source === "experience" ? 15 : 0) + matchedTokens;
    };
    return evidence
      .sort((a, b) => score(b) - score(a))
      .slice(0, 12);
  }

  async getCandidateProfile(candidateId?: string): Promise<StoredResume | null> {
    const profile = candidateId
      ? await this.repository.findById(candidateId)
      : (await this.repository.listResumes())[0] ?? null;
    if (!profile) return null;

    // Older ingested records may have raw CV text but no structured skills
    // array. Derive the same catalogue skills on read so matching still uses
    // the candidate's documented skills.
    const storedSkills = Array.isArray(profile.skills) ? profile.skills : [];
    const textSkills = detectSkills(profile.rawText ?? "");
    const skills = [...new Map([...storedSkills, ...textSkills].map((skill) => [skill.trim().toLowerCase(), skill.trim()])).values()].filter(Boolean);
    return { ...profile, skills };
  }

  private containsPhrase(text: string, phrase: string): boolean {
    const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return Boolean(escaped && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text));
  }

  private currentSection(rawText: string, fragment: string): string {
    const position = rawText.indexOf(fragment);
    if (position < 0) return "";
    const header = rawText.slice(0, position).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-1)[0] ?? "";
    return header.length <= 100 ? header : "";
  }
}
