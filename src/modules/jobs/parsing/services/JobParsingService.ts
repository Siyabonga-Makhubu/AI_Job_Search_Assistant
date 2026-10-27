import { detectSkills } from "../../../ingestion/services/AlgorithmResumeParser";
import { z } from "zod";
import { env } from "../../../../config/env";
import { createChatModel } from "../../../../config/chatModel";
import type { JobParseInput, ParsedJob } from "../types/parsing.types";

const JobExtractionSchema = z.object({
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  technologies: z.array(z.string()),
  responsibilities: z.array(z.string()),
  qualifications: z.array(z.string()),
  experienceRequirements: z.array(z.string()),
  educationRequirements: z.array(z.string()),
  remote: z.boolean().optional(),
  employmentType: z.string().optional(),
});

/**
 * JobParsingService
 *
 * Extracts structured fields from a cleaned job description.
 *
 * Strategy:
 *   1. Deterministic regex/section parsing for clearly delimited fields.
 *   2. detectSkills() from the existing Resume RAG skill catalogue â€”
 *      guarantees the same vocabulary is used for resumes and job posts.
 *   3. LLM-assisted extraction wired in Phase 3 for free-text fields that
 *      are hard to parse deterministically.
 *
 * The parser never invents values. If a section is absent from the input
 * the corresponding field is returned as an empty array or undefined.
 *
 * Current state (Phase 1): deterministic skeleton â€” compiles cleanly.
 * Phase 3 completes section parsing and adds optional LLM extraction.
 */
export class JobParsingService {
  parse(input: JobParseInput): ParsedJob {
    const text = input.cleanedText;
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

    const title = input.rawTitle ?? this.extractTitle(lines);
    const company = input.rawCompany ?? this.extractCompany(lines);
    const location = input.rawLocation ?? this.extractLocation(lines);
    const remote = this.detectRemote(text);
    const employmentType = this.detectEmploymentType(text);

    // Reuse existing skill catalogue â€” same vocabulary as resume parsing.
    const allDetectedSkills = detectSkills(text);

    const requiredSkills = this.extractSkillsInSection(text, allDetectedSkills, [
      "requirements",
      "essential skills and technologies",
      "generative ai and core fundamentals",
      "testing data and communication",
      "required skills",
      "must have",
      "must-have",
      "what you need",
      "you will need",
      "minimum requirements",
      "competencies and skillset",
      "have experience with llms and agents",
      "bring technical expertise",
      "embrace ai native development",
      "care about quality",
      "are innovation driven",
    ]);

    const preferredSkills = this.extractSkillsInSection(text, allDetectedSkills, [
      "preferred",
      "nice to have",
      "nice-to-have",
      "bonus",
      "advantageous",
      "preferred qualifications",
    ]).filter((s) => !requiredSkills.includes(s));

    // Skills not binned into required/preferred are flagged as general technologies.
    const technologies = allDetectedSkills.filter(
      (s) => !requiredSkills.includes(s) && !preferredSkills.includes(s)
    );

    const responsibilities = this.extractSection(text, [
      "responsibilities",
      "duties and responsibilities",
      "duties responsibilities",
      "what you will do",
      "key responsibilities",
      "role responsibilities",
      "your responsibilities",
      "what will you be doing",
      "what you will be doing",
      "key duties",
      "the role",
      "about the role",
    ]);

    const qualifications = this.extractSection(text, [
      "qualifications",
      "desired experience and qualification",
      "desired experience qualification",
      "minimum qualifications",
      "what you bring",
      "what we are looking for",
      "who you are",
      "competencies and skillset",
      "skills we expect",
      "what we expect you to have",
    ]);

    const experienceRequirements = this.extractSection(text, [
      "experience",
      "required experience",
      "work experience",
      "have experience",
    ]).filter((line) => /\d+\s*(?:\+)?\s*years?/i.test(line));

    const educationRequirements = this.extractSection(text, [
      "education",
      "educational requirements",
      "academic requirements",
    ]);

    return {
      title,
      company,
      location,
      remote,
      employmentType,
      responsibilities,
      requiredSkills,
      preferredSkills,
      technologies: this.uniqueCaseInsensitive(technologies),
      qualifications,
      experienceRequirements,
      educationRequirements,
    };
  }

  /** Extract requirements with LangChain when Groq is configured, then
   * merge them with deterministic extraction so known catalogue skills remain included. */
  async parseWithLangChain(input: JobParseInput): Promise<ParsedJob> {
    const deterministic = this.parse(input);
    if (!env.groqApiKey) return deterministic;

    try {
      const model = createChatModel({
        temperature: 0,
        maxRetries: 2,
      }).withStructuredOutput(JobExtractionSchema, { name: "job_requirement_extraction" });
      const extracted = await model.invoke([
        ["system", "Extract job requirements from the supplied public job listing. Only include facts stated in the listing; do not infer or invent skills, years, qualifications, or responsibilities. Put explicit must-have skills in requiredSkills, optional skills in preferredSkills, and other named tools/languages/frameworks in technologies. Return empty arrays when information is absent."],
        ["human", input.cleanedText.slice(0, 24_000)],
      ]);

      const merge = (primary: string[], extra: string[]) => this.uniqueCaseInsensitive([...primary, ...extra]);
      const requiredSkills = merge(extracted.requiredSkills, deterministic.requiredSkills);
      const requiredSkillSet = new Set(requiredSkills.map((skill) => skill.toLowerCase()));
      return {
        ...deterministic,
        title: input.rawTitle ?? deterministic.title,
        company: input.rawCompany ?? deterministic.company,
        location: input.rawLocation ?? deterministic.location,
        remote: extracted.remote ?? deterministic.remote,
        employmentType: extracted.employmentType ?? deterministic.employmentType,
        requiredSkills,
        preferredSkills: merge(extracted.preferredSkills, deterministic.preferredSkills).filter((skill) => !requiredSkillSet.has(skill.toLowerCase())),
        technologies: merge(extracted.technologies, deterministic.technologies),
        responsibilities: merge(extracted.responsibilities, deterministic.responsibilities),
        qualifications: merge(extracted.qualifications, deterministic.qualifications),
        experienceRequirements: merge(extracted.experienceRequirements, deterministic.experienceRequirements),
        educationRequirements: merge(extracted.educationRequirements, deterministic.educationRequirements),
      };
    } catch {
      console.warn(JSON.stringify({ event: "job_langchain_extraction_failed", message: "Groq structured extraction failed" }));
      return deterministic;
    }
  }

  // â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private extractTitle(lines: string[]): string | undefined {
    return (
      lines.find((l) => l.length >= 4 && l.length <= 120 && !/^\d/.test(l)) ??
      undefined
    );
  }

  private extractCompany(lines: string[]): string | undefined {
    return (
      lines.find(
        (l) =>
          /(pty|ltd|limited|inc\.?|llc|corp|solutions|technologies|ai|labs)\b/i.test(l) &&
          l.length < 80
      ) ?? undefined
    );
  }

  private extractLocation(lines: string[]): string | undefined {
    return (
      lines.find(
        (l) =>
          /(johannesburg|cape town|durban|pretoria|south africa|remote|hybrid|on-?site)/i.test(l) &&
          l.length < 80
      ) ?? undefined
    );
  }

  private detectRemote(text: string): boolean {
    return /\b(remote|work from home|wfh|fully remote)\b/i.test(text);
  }

  private detectEmploymentType(text: string): string | undefined {
    if (/\bfull[- ]time\b/i.test(text)) return "full-time";
    if (/\bpart[- ]time\b/i.test(text)) return "part-time";
    if (/\bcontract\b/i.test(text)) return "contract";
    if (/\bfixed[- ]term\b/i.test(text)) return "fixed-term";
    if (/\binternship\b/i.test(text)) return "internship";
    if (/\bgraduate\b/i.test(text)) return "graduate";
    return undefined;
  }

  /**
   * Extract bullet-point lines under one or more named section headings.
   */
  private extractSection(text: string, headings: string[]): string[] {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const wanted = headings.map(normalize);
    const boundaries = [...new Set([...wanted,
      "responsibilities", "key responsibilities", "role responsibilities", "your responsibilities", "what you will do", "what you ll do", "what will you be doing", "what you will be doing", "key duties", "key accountabilities", "duties",
      "requirements", "minimum requirements", "required skills", "essential skills", "must have", "must haves", "skills and experience", "experience and skills", "preferred skills", "nice to have", "nice to haves", "preferred qualifications",
      "essential skills and technologies", "generative ai and core fundamentals", "testing data and communication", "advantageous skills",
      "qualifications", "minimum qualifications", "what you bring", "what we are looking for", "who you are", "about you", "your profile", "education", "educational requirements", "academic requirements", "experience", "required experience", "work experience",
      "competencies and skillset", "skills we expect", "what we expect you to have", "have experience with llms and agents", "bring technical expertise", "embrace ai native development", "care about quality", "are innovation driven", "bonus points", "why join", "why is elixirr", "we could be a perfect fit", "compensation equity", "health wellbeing", "projects tools", "learning growth",
    ])];
    // Aggregator APIs (including Adzuna) often flatten HTML paragraphs into one
    // long line. Recreate boundaries for recognizable headings before scanning.
    const headingPattern = new RegExp(`(?:^|\\s+)(${boundaries.sort((a, b) => b.length - a.length).map((value) => value.replace(/ /g, "\\s+")).join("|")})(?=\\s*(?::|[-–—]|$))`, "gim");
    const sectionizedText = text.replace(/&/g, "and")
      .replace(headingPattern, "\n$1:")
      // Job boards frequently flatten HTML lists into prose. Restore line
      // breaks before short, title-cased labels such as "RAG & Agent Development:".
      .replace(/\s+(?=[A-Z][A-Za-z0-9 &(),/–—-]{2,90}:\s)/g, "\n");
    const lines = sectionizedText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const output: string[] = [];
    let capturing = false;
    for (const line of lines) {
      const content = line.replace(/^[-*•\u2022]+\s*/, "");
      const normalized = normalize(content);
      const heading = boundaries.some((candidate) => normalized === candidate || normalized.startsWith(`${candidate} `));
      if (heading) {
        const matched = wanted.find((candidate) => normalized === candidate || normalized.startsWith(`${candidate} `));
        capturing = Boolean(matched);
        if (matched) {
          const remainder = content.replace(new RegExp(`^${matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s:—–-]*`, "i"), "").trim();
          if (remainder.length > 12) output.push(remainder);
        }
      } else if (capturing && content.length > 5) {
        const label = content.match(/^(.{3,100}):\s*(.*)$/);
        const value = label?.[2]?.trim();
        if (value && value.length > 5) output.push(value);
        else if (!label) output.push(content);
      }
    }
    return output.flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/)).map((line) => line.trim()).filter((line) => line.length > 5 && line.length < 500);
  }

  private uniqueCaseInsensitive(values: string[]): string[] {
    const seen = new Set<string>();
    return values.map((value) => value.trim()).filter((value) => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  /**
   * Return skills from the detected set that appear inside a named section.
   * Falls back to all detected skills when the section cannot be found.
   */
  private extractSkillsInSection(
    text: string,
    detected: string[],
    headings: string[]
  ): string[] {
    const sectionLines = this.extractSection(text, headings);
    if (sectionLines.length === 0) return [];

    const sectionText = sectionLines.join(" ").toLowerCase();
    return detected.filter((s) => sectionText.includes(s.toLowerCase()));
  }
}
