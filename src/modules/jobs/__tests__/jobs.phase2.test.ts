import { app } from "../../../app";
import * as database from "../../../config/database";
import { getJobConfig } from "../../../config/jobConfig";
import { JobRepository } from "../ingestion/repositories/JobRepository";
import { TailoredCvService, type TailoredCvEdits } from "../matching/services/TailoredCvService";
import { CandidateEvidenceService } from "../matching/services/CandidateEvidenceService";
import { JobMatchingService } from "../matching/services/JobMatchingService";
import type { Job, TailoredCv } from "../types/job.types";
import type { JobMatchResponse } from "../matching/types/matching.types";
import type { StoredResume } from "../../retrieval/types/retrieval.types";
import type { Db } from "mongodb";

function sampleJob(overrides: Partial<Job> = {}): Job {
  return {
    jobId: "job_abc123",
    title: "Junior AI Engineer",
    company: "Example Co",
    location: "South Africa",
    remote: true,
    source: { provider: "web", url: "https://example.com/jobs/junior-ai" },
    description: "Build RAG systems with Python and MongoDB.",
    responsibilities: ["Implement retrieval pipelines"],
    requiredSkills: ["Python", "RAG"],
    preferredSkills: ["TypeScript"],
    technologies: ["MongoDB Atlas"],
    qualifications: [],
    experienceRequirements: [],
    educationRequirements: [],
    discoveredAt: new Date("2026-09-23T10:00:00.000Z"),
    rawText: "Junior AI Engineer at Example Co",
    contentHash: "hash-1",
    embedding: [0.1, 0.2],
    embeddingModel: "mistral-embed",
    embeddingDimensions: 2,
    ...overrides,
  };
}

function sampleTailoredCv(overrides: Partial<TailoredCv> = {}): TailoredCv {
  return {
    jobId: "job_abc123",
    jobTitle: "Junior AI Engineer",
    company: "Example Co",
    generatedAt: new Date("2026-10-01T10:00:00.000Z"),
    personalDetails: { name: "Candidate Name", email: "candidate@example.com", phone: "123456", location: "South Africa", linkedin: "", github: "", portfolio: "" },
    headline: "AI Engineer Intern",
    professionalSummary: "Resume evidence relevant to the role.",
    technicalSkills: [{ category: "Software Development", skills: ["Python"] }],
    projects: [{ title: "RAG project", details: ["Implemented a retrieval pipeline."] }],
    experience: [{ title: "Relevant role", details: ["Built APIs."] }],
    certificationsAndAchievements: [],
    skills: ["Python", "RAG"],
    relevantExperience: ["Implemented a retrieval pipeline."],
    matchedRequirements: ["Python"],
    partialRequirements: ["RAG"],
    education: "BSc Computer Science",
    ...overrides,
  };
}

async function withServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

describe("Phase 2 — job domain foundation", () => {
  it("exposes job search configuration without secrets", () => {
    const config = getJobConfig();

    expect(config.searchRoles.length).toBeGreaterThan(0);
    expect(config.searchRoles).toEqual(expect.arrayContaining(["AI Engineer"]));
    expect(config.searchLocation).toBeTruthy();
    expect(config.collectionName).toBeTruthy();
    expect(JSON.stringify(config)).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(JSON.stringify(config).toLowerCase()).not.toContain("api_key");
  });

  it("keeps a normalised Job shape with required identity fields", () => {
    const job = sampleJob();

    expect(job.jobId).toBeTruthy();
    expect(job.source.url).toMatch(/^https?:\/\//);
    expect(job.contentHash).toBeTruthy();
    expect(Array.isArray(job.requiredSkills)).toBe(true);
    expect(Array.isArray(job.responsibilities)).toBe(true);
  });

  it("GET /v1/jobs/health reports the jobs module", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/jobs/health`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("ok");
      expect(body.module).toBe("jobs");
      expect(body.collection).toBe(getJobConfig().collectionName);
    });
  });

  it("GET /v1/jobs/config returns typed job settings", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/jobs/config`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.config.searchRoles).toEqual(getJobConfig().searchRoles);
      expect(body.config.vectorTopK).toBe(getJobConfig().vectorTopK);
    });
  });

  it("GET /v1/jobs/overview returns live dashboard statistics and recent activity", async () => {
    const overview = {
      stats: { totalJobs: 12, savedJobs: 5, applications: 3, interviews: 2, offers: 1 },
      activity: [{
        type: "job_saved" as const,
        jobId: "job_abc123",
        title: "Junior AI Engineer",
        company: "Example Co",
        occurredAt: new Date("2026-10-15T10:00:00.000Z"),
      }],
    };
    const spy = jest.spyOn(JobRepository.prototype, "getDashboardOverview").mockResolvedValue(overview);

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/overview`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, ...overview });
        expect(body.activity[0].occurredAt).toBe("2026-10-15T10:00:00.000Z");
      });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /v1/jobs/:jobId returns JOB_NOT_FOUND when missing", async () => {
    const spy = jest
      .spyOn(JobRepository.prototype, "findByJobId")
      .mockResolvedValue(null);

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/missing-job`);
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.errorCode).toBe("JOB_NOT_FOUND");
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /v1/jobs/:jobId returns the stored job without embedding", async () => {
    const spy = jest
      .spyOn(JobRepository.prototype, "findByJobId")
      .mockResolvedValue(sampleJob());

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/job_abc123`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.job.jobId).toBe("job_abc123");
        expect(body.job.title).toBe("Junior AI Engineer");
        expect(body.job.embedding).toBeUndefined();
        expect(spy).toHaveBeenCalledWith("job_abc123");
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /v1/jobs/saved returns MongoDB saved jobs without embeddings", async () => {
    const spy = jest.spyOn(JobRepository.prototype, "listSavedJobs").mockResolvedValue([
      sampleJob({ savedAt: new Date("2026-10-01T10:00:00.000Z"), status: "SAVED" }),
    ]);

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/saved`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.jobs).toHaveLength(1);
        expect(body.jobs[0].status).toBe("SAVED");
        expect(body.jobs[0].embedding).toBeUndefined();
      });
    } finally { spy.mockRestore(); }
  });

  it("GET /v1/jobs/:jobId/tailored-cv returns the CV saved on the job document", async () => {
    const cv = sampleTailoredCv({ savedAt: new Date("2026-10-01T12:00:00.000Z") });
    const spy = jest.spyOn(JobRepository.prototype, "findByJobId").mockResolvedValue(sampleJob({ tailoredCv: cv }));
    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/job_abc123/tailored-cv`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.cv).toMatchObject({ jobId: "job_abc123", jobTitle: "Junior AI Engineer", education: "BSc Computer Science" });
      });
    } finally { spy.mockRestore(); }
  });

  it("POST /v1/jobs/:jobId/tailored-cv generates a draft without changing application status", async () => {
    const cv = sampleTailoredCv();
    const generateSpy = jest.spyOn(TailoredCvService.prototype, "generate").mockResolvedValue(cv);
    const statusSpy = jest.spyOn(JobRepository.prototype, "updateApplicationTracking");
    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/job_abc123/tailored-cv`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.cv.jobId).toBe("job_abc123");
      });
      expect(generateSpy).toHaveBeenCalledWith("job_abc123", undefined);
      expect(statusSpy).not.toHaveBeenCalled();
    } finally { generateSpy.mockRestore(); statusSpy.mockRestore(); }
  });

  it("PUT /v1/jobs/:jobId/tailored-cv accepts editable sections but rejects candidate-name changes", async () => {
    const cv = sampleTailoredCv({ savedAt: new Date("2026-10-01T12:00:00.000Z") });
    const saveSpy = jest.spyOn(TailoredCvService.prototype, "save").mockResolvedValue(cv);
    const edits: TailoredCvEdits = {
      personalDetails: { email: cv.personalDetails.email, phone: cv.personalDetails.phone, location: cv.personalDetails.location, linkedin: cv.personalDetails.linkedin, github: cv.personalDetails.github, portfolio: cv.personalDetails.portfolio },
      education: "Updated degree",
      projects: [{ title: "Edited project", details: ["User-edited project detail"] }],
      experience: [{ title: "Edited role", details: ["User-edited experience detail"] }],
      certificationsAndAchievements: ["Edited certification"],
    };
    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/job_abc123/tailored-cv`, {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify(edits),
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.cv.savedAt).toBe("2026-10-01T12:00:00.000Z");
        expect(saveSpy).toHaveBeenCalledWith("job_abc123", edits, undefined);

        const invalidName = await fetch(`${baseUrl}/v1/jobs/job_abc123/tailored-cv`, {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...edits, personalDetails: { ...edits.personalDetails, name: "Changed name" } }),
        });
        expect(invalidName.status).toBe(400);
        expect((await invalidName.json()).errorCode).toBe("INVALID_APPLICATION_UPDATE");

        const invalidSection = await fetch(`${baseUrl}/v1/jobs/job_abc123/tailored-cv`, {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...edits, skills: ["uneditable"] }),
        });
        expect(invalidSection.status).toBe(400);
      });
      expect(saveSpy).toHaveBeenCalledTimes(1);
    } finally { saveSpy.mockRestore(); }
  });

  it("persists editable CV sections while preserving the generated candidate name", async () => {
    const generated = sampleTailoredCv();
    const edits: TailoredCvEdits = {
      personalDetails: { email: "updated@example.com", phone: "555", location: "Durban", linkedin: "", github: "", portfolio: "" },
      education: "Updated education",
      projects: [{ title: "Edited project", details: ["Edited detail"] }],
      experience: [],
      certificationsAndAchievements: ["New certification"],
    };
    const generateSpy = jest.spyOn(TailoredCvService.prototype, "generate").mockResolvedValue(generated);
    const repositorySpy = jest.spyOn(JobRepository.prototype, "saveTailoredCv").mockImplementation(async (_jobId, tailoredCv) => sampleJob({ tailoredCv }));
    try {
      const savedCv = await new TailoredCvService().save("job_abc123", edits);
      expect(savedCv.personalDetails.name).toBe(generated.personalDetails.name);
      expect(savedCv.personalDetails.email).toBe("updated@example.com");
      expect(savedCv.education).toBe("Updated education");
      expect(savedCv.projects).toEqual(edits.projects);
      expect(savedCv.experience).toEqual([]);
      expect(savedCv.certificationsAndAchievements).toEqual(["New certification"]);
      expect(repositorySpy).toHaveBeenCalledWith("job_abc123", expect.objectContaining({
        education: edits.education,
        projects: edits.projects,
        experience: edits.experience,
        certificationsAndAchievements: edits.certificationsAndAchievements,
        personalDetails: expect.objectContaining({ ...edits.personalDetails, name: generated.personalDetails.name }),
      }));
    } finally { generateSpy.mockRestore(); repositorySpy.mockRestore(); }
  });

  it("generates the requested CV sections from documented evidence and excludes template placeholders", async () => {
    const profile: StoredResume = {
      _id: "resume_123",
      name: "Siyabonga Nkabinde",
      role: "AI Engineer Intern",
      email: "siyabonga@example.com",
      phone: "079 123 4567",
      location: "Johannesburg, South Africa",
      education: "[DEGREE] | University\nBSc Computer Science",
      experienceSummary: "Software development experience with documented RAG work.",
      skills: ["Python", "RAG", "Docker"],
      rawText: "https://linkedin.com/in/siyabonga\nhttps://github.com/siyabonga\nhttps://portfolio.example.com\nCertifications and Achievements\n[ISSUING ORGANIZATION]\nAWS Certified Developer\nEducation\n[DEGREE]",
      embedding: [],
    };
    const match: JobMatchResponse = {
      jobId: "job_abc123",
      candidateId: "resume_123",
      matchedRequirements: [{ requirement: "RAG", status: "MATCHED", evidence: [{ source: "skill", name: "RAG", text: "Resume skills list includes RAG." }] }],
      partialRequirements: [{ requirement: "Python services", status: "PARTIAL", evidence: [{ source: "skill", name: "Python", text: "Resume skills list includes Python." }] }],
      notEvidencedRequirements: [],
      relevantSkills: ["RAG", "Python"],
      relevantProjects: ["Built a retrieval application."],
      relevantExperience: ["Developed backend APIs."],
      relevantEducation: ["BSc Computer Science"],
      evidence: [
        { source: "project", name: "Resume RAG Application", text: "Built a retrieval application." },
        { source: "experience", name: "AI Engineer Intern | Example Co", text: "Developed backend APIs." },
      ],
      summary: "Evidence supports the listed requirements.",
      analysedAt: "2026-10-01T10:00:00.000Z",
    };
    const jobSpy = jest.spyOn(JobRepository.prototype, "findByJobId").mockResolvedValue(sampleJob());
    const profileSpy = jest.spyOn(CandidateEvidenceService.prototype, "getCandidateProfile").mockResolvedValue(profile);
    const matchSpy = jest.spyOn(JobMatchingService.prototype, "analyseJobMatch").mockResolvedValue(match);
    try {
      const cv = await new TailoredCvService().generate("job_abc123");
      expect(cv.headline).toBe("AI Engineer Intern");
      expect(cv.personalDetails.linkedin).toContain("linkedin.com/in/siyabonga");
      expect(cv.personalDetails.github).toContain("github.com/siyabonga");
      expect(cv.personalDetails.portfolio).toBe("https://portfolio.example.com");
      expect(cv.technicalSkills.find((group) => group.category === "Generative AI and LLM Engineering")?.skills).toContain("RAG");
      expect(cv.projects).toEqual([{ title: "Resume RAG Application", details: ["Built a retrieval application."] }]);
      expect(cv.experience).toEqual([{ title: "AI Engineer Intern | Example Co", details: ["Developed backend APIs."] }]);
      expect(cv.certificationsAndAchievements).toEqual(["AWS Certified Developer"]);
      expect(cv.education).toBe("BSc Computer Science");
      expect(JSON.stringify(cv)).not.toContain("[DEGREE]");
      expect(JSON.stringify(cv)).not.toContain("[ISSUING ORGANIZATION]");
    } finally { jobSpy.mockRestore(); profileSpy.mockRestore(); matchSpy.mockRestore(); }
  });

  it("PATCH /v1/jobs/:jobId/status accepts only supported user-selected statuses", async () => {
    const savedJob = sampleJob({ savedAt: new Date("2026-10-01T10:00:00.000Z"), status: "SAVED" });
    const findSpy = jest.spyOn(JobRepository.prototype, "findByJobId").mockResolvedValue(savedJob);
    const updateSpy = jest.spyOn(JobRepository.prototype, "updateApplicationTracking").mockImplementation(async (_jobId, update) => sampleJob({ ...savedJob, ...update }));

    try {
      await withServer(async (baseUrl) => {
        for (const status of ["SAVED", "ANALYSED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "CLOSED"]) {
          const response = await fetch(`${baseUrl}/v1/jobs/job_abc123/status`, {
            method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
          });
          const body = await response.json();
          expect(response.status).toBe(200);
          expect(body.job.status).toBe(status);
        }

        const invalid = await fetch(`${baseUrl}/v1/jobs/job_abc123/status`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "APPLIED_AUTOMATICALLY" }),
        });
        expect(invalid.status).toBe(400);
        expect((await invalid.json()).errorCode).toBe("INVALID_APPLICATION_UPDATE");
      });
      expect(updateSpy).toHaveBeenCalledTimes(7);
      expect(findSpy).toHaveBeenCalledTimes(7);
    } finally { findSpy.mockRestore(); updateSpy.mockRestore(); }
  });

  it("PATCH /v1/jobs/:jobId/application validates and persists status and dates", async () => {
    const savedJob = sampleJob({ savedAt: new Date("2026-10-01T10:00:00.000Z"), status: "SAVED" });
    const findSpy = jest.spyOn(JobRepository.prototype, "findByJobId").mockResolvedValue(savedJob);
    const updateSpy = jest.spyOn(JobRepository.prototype, "updateApplicationTracking").mockImplementation(async (_jobId, update) => sampleJob({ ...savedJob, ...update }));

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/jobs/job_abc123/application`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "APPLIED", appliedAt: "2026-10-01T10:00:00Z", interviewDate: null }),
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.job.status).toBe("APPLIED");
        expect(body.job.appliedAt).toBe("2026-10-01T10:00:00.000Z");
        expect(body.job.interviewDate).toBeNull();
        expect(updateSpy).toHaveBeenCalledWith("job_abc123", {
          status: "APPLIED", appliedAt: new Date("2026-10-01T10:00:00Z"), interviewDate: null,
        });

        const invalid = await fetch(`${baseUrl}/v1/jobs/job_abc123/application`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ interviewDate: "not-a-date" }),
        });
        expect(invalid.status).toBe(400);
        expect((await invalid.json()).message).toContain("interviewDate");
      });
    } finally { findSpy.mockRestore(); updateSpy.mockRestore(); }
  });

  it("JobRepository.ensureIndexes creates unique identity indexes", async () => {
    const createIndex = jest.fn().mockResolvedValue("ok");
    const collection = { createIndex };
    const db = { collection: jest.fn().mockReturnValue(collection) };
    const dbSpy = jest.spyOn(database, "getDatabase").mockResolvedValue(db as unknown as Db);

    try {
      await new JobRepository().ensureIndexes();
      expect(db.collection).toHaveBeenCalledWith(getJobConfig().collectionName);
      expect(createIndex).toHaveBeenCalledWith(
        { jobId: 1 },
        expect.objectContaining({ unique: true })
      );
      expect(createIndex).toHaveBeenCalledWith(
        { "source.url": 1 },
        expect.objectContaining({ unique: true })
      );
    } finally {
      dbSpy.mockRestore();
    }
  });

  it("JobRepository saves a job once and persists subsequent tracking updates", async () => {
    let document = sampleJob();
    const findOne = jest.fn(async () => document);
    const updateOne = jest.fn(async (_filter, update) => {
      document = { ...document, ...update.$set };
      return { matchedCount: 1 };
    });
    const collection = { findOne, updateOne };
    const dbSpy = jest.spyOn(database, "getDatabase").mockResolvedValue({ collection: jest.fn().mockReturnValue(collection) } as unknown as Db);

    try {
      const repository = new JobRepository();
      const saved = await repository.saveJob("job_abc123");
      expect(saved?.status).toBe("SAVED");
      expect(saved?.savedAt).toBeInstanceOf(Date);

      const appliedAt = new Date("2026-10-01T10:00:00.000Z");
      const updated = await repository.updateApplicationTracking("job_abc123", { status: "APPLIED", appliedAt, interviewDate: null });
      expect(updated).toMatchObject({ status: "APPLIED", appliedAt, interviewDate: null });
      expect(document.status).toBe("APPLIED");

      const tailoredCv = sampleTailoredCv({ savedAt: new Date("2026-10-01T12:00:00.000Z") });
      const cvUpdated = await repository.saveTailoredCv("job_abc123", tailoredCv);
      expect(cvUpdated?.tailoredCv).toEqual(tailoredCv);
      expect(document.tailoredCv).toEqual(tailoredCv);
      expect(document.status).toBe("APPLIED");
    } finally { dbSpy.mockRestore(); }
  });
});
