import { JobRepository } from "../../ingestion/repositories/JobRepository";
import type { CandidateEvidence, TailoredCv } from "../../types/job.types";
import { CandidateEvidenceService } from "./CandidateEvidenceService";
import { JobMatchingService } from "./JobMatchingService";

export type TailoredCvEdits = {
  personalDetails: Omit<TailoredCv["personalDetails"], "name">;
  education: string;
  projects: TailoredCv["projects"];
  experience: TailoredCv["experience"];
  certificationsAndAchievements: string[];
};

const skillCategories = [
  { category: "AI and Machine Learning", matches: /machine learning|\bml\b|deep learning|natural language|\bnlp\b|computer vision|model training|feature engineering/i },
  { category: "Generative AI and LLM Engineering", matches: /large language|\bllm\b|prompt|\brag\b|embedding|vector database|ai agent|\bagents?\b|\bmcp\b|fine.tun|model evaluation/i },
  { category: "Software Development", matches: /python|javascript|typescript|java|c\+\+|c#|backend|api design|rest api|object.oriented|data structure|algorithm|react|node/i },
  { category: "Data and Databases", matches: /\bsql\b|database|mongodb|postgres|mysql|nosql|data preprocess|data pipeline|\betl\b|vector search|redis/i },
  { category: "MLOps and Cloud", matches: /docker|ci\/cd|model serving|experiment tracking|cloud|deployment|monitoring|kubernetes|aws|azure|gcp/i },
  { category: "Engineering Practices", matches: /\bgit\b|version control|testing|debugging|code review|documentation|agile|reproducible/i },
];

const sectionHeading = /^(professional summary|summary|technical skills?|skills|selected .*projects?|projects|experience|work experience|professional experience|employment history|education|certifications?( and achievements)?|achievements?|awards?|languages|references)$/i;

function cleanCvText(value: string | null | undefined): string {
  const text = (value ?? "").replace(/^\s*[-•*]\s*/, "").trim();
  if (!text || /\[[A-Z][A-Z0-9 ,./()&'-]*\]/i.test(text)) return "";
  return text;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanCvText).filter(Boolean))];
}

function extractSection(rawText: string, desiredHeading: RegExp): string[] {
  let collecting = false;
  const entries: string[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length <= 100 && sectionHeading.test(line)) {
      collecting = desiredHeading.test(line);
      continue;
    }
    if (collecting) entries.push(line);
  }
  return unique(entries);
}

function groupedEvidence(evidence: CandidateEvidence[], source: "project" | "experience", fallbackItems: string[]): Array<{ title: string; details: string[] }> {
  const groups = new Map<string, string[]>();
  for (const item of evidence.filter((entry) => entry.source === source)) {
    const title = cleanCvText(item.name) || (source === "project" ? "Relevant project details" : "Relevant role details");
    const detail = cleanCvText(item.text);
    if (!detail) continue;
    groups.set(title, [...(groups.get(title) ?? []), detail]);
  }
  if (!groups.size && fallbackItems.length) {
    return [{ title: source === "project" ? "Selected AI and software projects" : "Relevant experience", details: unique(fallbackItems) }];
  }
  return [...groups].map(([title, details]) => ({ title, details: unique(details) })).filter((group) => group.details.length > 0);
}

function categorizeSkills(skills: string[]): Array<{ category: string; skills: string[] }> {
  const remaining = new Set(skills);
  const categories = skillCategories.map(({ category, matches }) => {
    const selected = [...remaining].filter((skill) => matches.test(skill));
    selected.forEach((skill) => remaining.delete(skill));
    return { category, skills: selected };
  });
  if (remaining.size) categories.push({ category: "Other documented skills", skills: [...remaining] });
  return categories;
}

function findContactLink(rawText: string, host: string): string {
  const link = rawText.match(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${host}\\/[^\\s|,]+`, "i"))?.[0] ?? "";
  return link.replace(/[).,;]+$/, "");
}

function findPortfolioLink(rawText: string): string {
  const links = rawText.match(/https?:\/\/[^\s|,]+/gi) ?? [];
  return links.map((link) => link.replace(/[).,;]+$/, "")).find((link) => !/linkedin\.com|github\.com/i.test(link)) ?? "";
}

export class TailoredCvService {
  constructor(
    private readonly jobs = new JobRepository(),
    private readonly matching = new JobMatchingService(),
    private readonly candidateEvidence = new CandidateEvidenceService(),
  ) {}

  async generate(jobId: string, candidateId?: string): Promise<TailoredCv> {
    const job = await this.jobs.findByJobId(jobId);
    if (!job) throw Object.assign(new Error(`Job not found: ${jobId}`), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });

    const profile = await this.candidateEvidence.getCandidateProfile(candidateId);
    if (!profile) throw Object.assign(new Error("No candidate profile found in the Resume RAG database"), { statusCode: 404, errorCode: "CANDIDATE_PROFILE_NOT_FOUND" });

    const match = await this.matching.analyseJobMatch({ jobId, candidateId: profile._id?.toString() ?? candidateId });
    const skillEvidence = (entries: typeof match.matchedRequirements) => entries.flatMap((entry) =>
      entry.evidence.filter((evidence) => evidence.source === "skill").map((evidence) => evidence.name ?? evidence.technology ?? ""),
    );
    const skills = [...new Set([
      ...skillEvidence(match.matchedRequirements),
      ...skillEvidence(match.partialRequirements),
      ...(profile.skills ?? []),
    ].map(cleanCvText).filter(Boolean))];
    const relevantExperience = [...new Set([
      ...match.relevantExperience,
      ...match.relevantProjects,
    ].map(cleanCvText).filter(Boolean))];
    const matchedRequirements = match.matchedRequirements.map((entry) => entry.requirement);
    const partialRequirements = match.partialRequirements.map((entry) => entry.requirement);
    const documentedAlignment = [...matchedRequirements, ...partialRequirements].slice(0, 5);
    const professionalSummary = cleanCvText(profile.experienceSummary) || (documentedAlignment.length
      ? `Resume evidence relevant to ${job.title}: ${documentedAlignment.join(", ")}.`
      : profile.role ? `Resume lists ${profile.role} as the candidate's current or target role.` : "Resume content selected for relevance to this job's requirements.");
    const sourceText = profile.rawText ?? "";
    const education = unique((profile.education ?? "").split(/\r?\n/)).join("\n") || unique(match.relevantEducation).join("\n");

    return {
      jobId,
      jobTitle: job.title,
      company: job.company,
      generatedAt: new Date(),
      personalDetails: {
        name: cleanCvText(profile.name),
        email: cleanCvText(profile.email),
        phone: cleanCvText(profile.phone),
        location: cleanCvText(profile.location ?? profile.address),
        linkedin: findContactLink(sourceText, "linkedin\\.com"),
        github: findContactLink(sourceText, "github\\.com"),
        portfolio: findPortfolioLink(sourceText),
      },
      headline: cleanCvText(profile.role) || cleanCvText(profile.jobTitles?.[0]) || job.title,
      professionalSummary,
      technicalSkills: categorizeSkills(skills),
      projects: groupedEvidence(match.evidence, "project", match.relevantProjects),
      experience: groupedEvidence(match.evidence, "experience", match.relevantExperience),
      certificationsAndAchievements: extractSection(sourceText, /certification|achievement|award/i),
      skills,
      relevantExperience,
      matchedRequirements,
      partialRequirements,
      education,
    };
  }

  async save(jobId: string, edits: TailoredCvEdits, candidateId?: string): Promise<TailoredCv> {
    const generated = await this.generate(jobId, candidateId);
    const tailoredCv: TailoredCv = {
      ...generated,
      ...edits,
      personalDetails: { ...generated.personalDetails, ...edits.personalDetails },
      savedAt: new Date(),
    };
    const job = await this.jobs.saveTailoredCv(jobId, tailoredCv);
    if (!job?.tailoredCv) throw Object.assign(new Error(`Job not found: ${jobId}`), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });
    return job.tailoredCv;
  }
}