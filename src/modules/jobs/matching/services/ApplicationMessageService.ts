import { JobRepository } from "../../ingestion/repositories/JobRepository";
import { JobMatchingService } from "./JobMatchingService";
import type { Job, JobMatchAnalysis } from "../../types/job.types";

export interface ApplicationDraft {
  jobId: string;
  candidateId: string;
  message: string;
  messageType: ApplicationMessageType;
  evidenceUsed: string[];
  status: "DRAFT";
  historyId: string;
}
export type ApplicationMessageType = "Recruiter message" | "Cover letter" | "Email" | "LinkedIn message";
export type ApplicationMessageOptions = { company?: string; companyAddress?: string; recipient?: string; senderName?: string; subject?: string };

export class ApplicationMessageService {
  constructor(private readonly jobs = new JobRepository(), private readonly matching = new JobMatchingService()) {}

  async generate(jobId: string, candidateId?: string, messageType: ApplicationMessageType = "Recruiter message", options: ApplicationMessageOptions = {}): Promise<ApplicationDraft> {
    const analysis = await this.matching.analyseJobMatch({ jobId, candidateId });
    const job = await this.jobs.findByJobId(jobId);
    if (!job) throw Object.assign(new Error(`Job not found: ${jobId}`), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });
    return this.generateFromAnalysis(job, analysis, messageType, options);
  }

  async generateFromAnalysis(job: Job, analysis: JobMatchAnalysis, messageType: ApplicationMessageType = "Recruiter message", options: ApplicationMessageOptions = {}): Promise<ApplicationDraft> {
    const evidenceUsed = [...new Set([
      ...analysis.relevantSkills.map((skill) => `skill: ${skill}`),
      ...analysis.relevantProjects.map((project) => `project: ${project.slice(0, 180)}`),
      ...analysis.relevantExperience.map((item) => `experience: ${item.slice(0, 180)}`),
    ])].slice(0, 8);
    const factualItems = analysis.evidence.slice(0, 3).map((item) => item.source === "skill"
      ? item.name ?? item.technology
      : item.text).filter((item): item is string => Boolean(item));
    const company = options.company?.trim() || job.company?.trim() || "";
    const companyAddress = options.companyAddress?.trim() || "";
    const recipient = options.recipient?.trim() || "";
    const senderName = options.senderName?.trim() || "[Your name]";
    const subject = options.subject?.trim() || `Application for ${job.title}`;
    const greetingName = recipient && !recipient.includes("@")
      ? recipient
      : company ? `${company} hiring team` : "hiring team";
    const greeting = `Dear ${greetingName},`;
    const sentence = factualItems.length
      ? `My resume documents ${factualItems.join("; ")}.`
      : "I am interested in learning more about this opportunity.";
    const aligned = analysis.matchedRequirements.slice(0, 3).map((item) => item.requirement);
    const matchSentence = aligned.length
      ? `This evidence is relevant to the role's stated requirements for ${aligned.join(", ")}.`
      : "I would welcome the opportunity to discuss how my documented background may fit the role.";
    const roleAtCompany = `the ${job.title}${company ? ` position at ${company}` : " role"}`;
    const core = `I am interested in ${roleAtCompany}. ${sentence} ${matchSentence}`;
    const message = messageType === "Cover letter"
      ? `${senderName}\n${new Date().toISOString().slice(0, 10)}\n\n${recipient || "Hiring Manager"}${company ? `\n${company}` : ""}${companyAddress ? `\n${companyAddress}` : ""}\n\n${greeting}\n\nI am writing to apply for ${roleAtCompany}. ${sentence} ${matchSentence}\n\nThank you for considering my application. I would welcome the opportunity to discuss my application further.\n\nSincerely,\n${senderName}`
      : messageType === "Email"
        ? `To: ${recipient || "Hiring team"}\nSubject: ${subject}\n\n${greeting}\n\n${core}\n\nThank you for your consideration.\n\nKind regards,\n${senderName}`
        : messageType === "LinkedIn message"
          ? `Hi ${recipient || "there"},\n\nI came across the ${job.title}${company ? ` opportunity at ${company}` : " opportunity"} and wanted to reach out. ${sentence} I would welcome the opportunity to connect and discuss how my documented experience may be relevant.\n\nThank you,\n${senderName}`
          : `${greeting}\n\n${core}\n\nThank you for your consideration.\n\nKind regards,\n${senderName}`;
    await this.jobs.ensureApplicationMessageIndexes();
    const historyId = await this.jobs.saveApplicationMessage({
      jobId: job.jobId,
      candidateId: analysis.candidateId,
      message,
      evidenceUsed,
      generatedAt: new Date(),
      status: "DRAFT",
    });
    console.info(JSON.stringify({ event: "application_message_drafted", jobId: job.jobId, candidateId: analysis.candidateId, historyId }));
    return { jobId: job.jobId, candidateId: analysis.candidateId, message, messageType, evidenceUsed, status: "DRAFT", historyId };
  }
}
