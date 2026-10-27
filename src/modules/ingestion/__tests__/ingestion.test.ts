import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanText } from '../utils/textCleaner';
import { detectSkills, normalizeResumeFields, parseResume } from '../services/AlgorithmResumeParser';
import { ResumeParserService } from '../services/ResumeParserService';
import { EMAIL_REGEX, EXPERIENCE_REGEX } from '../utils/regex';
import { errorHandler } from '../../../middleware/errorHandler';
import { logger } from '../../../middleware/logger';
import { app } from '../../../app';
import { checkDatabase } from '../../../config/database';
import { ResumeIngestionRepository } from '../repositories/ResumeIngestionRepository';
import { ResumeIngestionService } from '../services/ResumeIngestionService';

jest.mock('pdf-parse', () => {
  class MockPDFParse {
    constructor(_data: Uint8Array) {}

    async getText() {
      return {
        text: 'Rajesh Mohan Kumar\nSenior Test Engineer',
        pages: [{ num: 1, text: 'Rajesh Mohan Kumar\nSenior Test Engineer' }],
        total: 1
      };
    }
  }

  return { PDFParse: MockPDFParse };
});

describe('resume ingestion utilities', () => {
  it('normalizes whitespace without losing technical content', () => {
    const input = 'Rajesh Mohan Kumar\n\n\nTest Architect & Senior Agentic Test Engineer   \n RAG';

    expect(cleanText(input)).toBe('Rajesh Mohan Kumar\nTest Architect & Senior Agentic Test Engineer\nRAG');
  });

  it('extracts an email and numeric years from text', () => {
    const text = 'Rajesh.mohan@email.com has 13+ years of experience';

    expect(text.match(EMAIL_REGEX)?.[0]).toBe('Rajesh.mohan@email.com');
    expect(text.match(EXPERIENCE_REGEX)?.[0]).toMatch(/13/i);
  });

  it('detects skills from resume text', () => {
    const skills = detectSkills('Experienced in Selenium WebDriver, Python, RAG, DeepEval and MCP (Model Context Protocol).');

    expect(skills).toEqual(expect.arrayContaining(['Selenium', 'Python', 'RAG', 'DeepEval', 'MCP (Model Context Protocol)']));
  });

  it('parses a structured resume summary from cleaned text', () => {
    const resume = parseResume(`Rajesh Mohan Kumar
Test Architect & Senior Agentic Test Engineer
Selenium WebDriver | Core Java | C# | Python | RAG | DeepEval
Testleaf Software Solutions Private Limited
B.Tech - Information Technology
13+ years of experience`);

    expect(resume.name).toBe('Rajesh Mohan Kumar');
    expect(resume.role).toContain('Test Architect');
    expect(resume.company).toBe('Testleaf Software Solutions Private Limited');
    expect(resume.education).toContain('B.Tech');
    expect(resume.totalExperience).toBeGreaterThanOrEqual(13);
    expect(resume.skills).toEqual(expect.arrayContaining(['Selenium WebDriver', 'Python', 'RAG', 'DeepEval']));
  });

  it('maps contact and role evidence to semantic fields', () => {
    const resume = parseResume(`Siyabonga Makhubu
  17 Nkupane Street | syabongokuhle18@gmail.com | 0767175041
AI Engineer`);

    expect(resume.name).toBe('Siyabonga Makhubu');
    expect(resume.address).toBe('17 Nkupane Street');
    expect(resume.email).toBe('syabongokuhle18@gmail.com');
    expect(resume.phone).toBe('0767175041');
    expect(resume.role).toBe('AI Engineer');
  });

  it('does not use the candidate name as a fallback role', () => {
    const resume = parseResume(`Siyabonga Makhubu
17 Nkupane Street
syabongokuhle18@gmail.com
0767175041`);

    expect(resume.name).toBe('Siyabonga Makhubu');
    expect(resume.role).toBeNull();
  });

  it('rejects non-address legacy values from the address field', () => {
    const fields = normalizeResumeFields({
      rawText: 'yugeshvarma m s\ndigital marketing executive\nyugeshvarma023@gmail.com\n8870826640',
      address: 'b.tech - biomedical engineering, dr.m.g.r. educational and research institute'
    });

    expect(fields.address).toBeNull();
    expect(fields.name).toBe('yugeshvarma m s');
    expect(fields.role).toBe('digital marketing executive');
  });

  it('reads resume text from the PDFParse result object', async () => {
    const readFileSpy = jest.spyOn(require('node:fs/promises'), 'readFile').mockResolvedValue(Buffer.from('fake-pdf'));

    const service = new ResumeParserService();
    const text = await service.extractTextFromPdf('resume.pdf');

    expect(text).toContain('Rajesh Mohan Kumar');
    expect(text).toContain('Senior Test Engineer');
    expect(readFileSpy).toHaveBeenCalledWith('resume.pdf');

    readFileSpy.mockRestore();
  });

  it('maps ingestion errors to stable responses with request ids', () => {
    const error = Object.assign(new Error('Mistral embedding failed'), {
      statusCode: 502,
      errorCode: 'EMBEDDING_FAILED'
    });

    const req = {} as any;
    const res = {
      locals: { requestId: 'abc123' },
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as any;

    errorHandler(error, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      requestId: 'abc123',
      errorCode: 'EMBEDDING_FAILED',
      message: 'The request could not be completed'
    }));
  });

  it('logs a structured request record with request id and file metadata', () => {
    const req = {
      method: 'POST',
      originalUrl: '/v1/resume/ingest',
      file: { originalname: 'resume.pdf' }
    } as any;

    const res = {
      locals: { requestId: 'abc123' },
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
        return res;
      })
    } as any;

    const next = jest.fn();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logger(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"requestId":"abc123"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"endpoint":"/v1/resume/ingest"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"fileName":"resume.pdf"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"statusCode":200'));

    logSpy.mockRestore();
  });

  it('exposes the health endpoints with request ids over the app', async () => {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const healthResponse = await fetch(`http://127.0.0.1:${port}/v1/health`);
      const healthBody = await healthResponse.json();

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.headers.get('x-request-id')).toBeTruthy();
      expect(healthBody.status).toBe('ok');
      expect(healthBody.app).toBe('resume-rag-backend');

      const dbCheck = jest.spyOn(require('../../../config/database'), 'checkDatabase').mockResolvedValue(18);
      const dbResponse = await fetch(`http://127.0.0.1:${port}/v1/health/db`);
      const dbBody = await dbResponse.json();

      expect(dbResponse.status).toBe(200);
      expect(dbBody.connected).toBe(true);
      expect(dbBody.latencyMs).toBe(18);
      dbCheck.mockRestore();
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    }
  });

  it('rejects invalid PDF uploads with a stable error contract', async () => {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const formData = new FormData();
      formData.append('file', new Blob(['not-a-pdf'], { type: 'image/png' }), 'bad.png');

      const response = await fetch(`http://127.0.0.1:${port}/v1/resume/upload`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(415);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe('INVALID_FILE_TYPE');
      expect(body.message).toBe('Only PDF files are allowed');
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    }
  });

  it('extracts and parses resume data from the app endpoints', async () => {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'));
      const pdfPath = path.join(tempDir, 'resume.pdf');
      const rawText = `Rajesh Mohan Kumar
Test Architect & Senior Agentic Test Engineer
Selenium WebDriver | Core Java | C# | Python | RAG | DeepEval
Testleaf Software Solutions Private Limited
B.Tech - Information Technology
13+ years of experience`;
      fs.writeFileSync(pdfPath, 'fake pdf content');

      jest.spyOn(ResumeParserService.prototype, 'extractTextFromPdf').mockResolvedValue(rawText);

      const formData = new FormData();
      formData.append('file', new Blob(['fake pdf'], { type: 'application/pdf' }), 'resume.pdf');

      const extractResponse = await fetch(`http://127.0.0.1:${port}/v1/resume/extract`, {
        method: 'POST',
        body: formData
      });

      expect(extractResponse.status).toBe(200);
      const extractBody = await extractResponse.json();
      expect(extractBody.success).toBe(true);
      expect(extractBody.rawText).toContain('Rajesh Mohan Kumar');

      const parseResponse = await fetch(`http://127.0.0.1:${port}/v1/resume/parse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rawText })
      });

      expect(parseResponse.status).toBe(200);
      const parseBody = await parseResponse.json();
      expect(parseBody.success).toBe(true);
      expect(parseBody.resume.name).toBe('Rajesh Mohan Kumar');
      expect(parseBody.resume.role).toContain('Test Architect');
      expect(parseBody.resume.company).toBe('Testleaf Software Solutions Private Limited');
      expect(parseBody.resume.totalExperience).toBeGreaterThanOrEqual(13);
      expect(parseBody.resume.skills).toEqual(expect.arrayContaining(['Selenium WebDriver', 'Python', 'RAG', 'DeepEval']));
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    }
  });

  it('validates the embedding response contract and repository insert path', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('api.mistral.ai')) {
        return {
          ok: true,
          json: async () => ({ data: [{ embedding: Array.from({ length: 6 }, (_, index) => index * 0.1) }] })
        } as Response;
      }
      return originalFetch(input, init);
    });
    const repositorySpy = jest.spyOn(ResumeIngestionRepository.prototype, 'insertResume').mockResolvedValue('resume_123');

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const embedResponse = await fetch(`http://127.0.0.1:${port}/v1/resume/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Rajesh Mohan Kumar',
          role: 'Test Architect',
          skills: ['RAG', 'DeepEval'],
          company: 'Testleaf Software Solutions Private Limited',
          rawText: 'Rajesh Mohan Kumar experienced in RAG and DeepEval.'
        })
      });

      expect(embedResponse.status).toBe(200);
      const embedBody = await embedResponse.json();
      expect(embedBody.success).toBe(true);
      expect(embedBody.model).toBe('mistral-embed');
      expect(embedBody.dimension).toBe(6);
      expect(embedBody.embedding).toHaveLength(6);

      const storeResponse = await fetch(`http://127.0.0.1:${port}/v1/resume/store`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: 'resume.pdf',
          rawText: 'Rajesh Mohan Kumar RAG DeepEval',
          resume: {
            name: 'Rajesh Mohan Kumar',
            role: 'Test Architect',
            company: 'Testleaf Software Solutions Private Limited',
            skills: ['RAG', 'DeepEval'],
            totalExperience: 13
          },
          embedding: Array.from({ length: 6 }, (_, index) => index * 0.1)
        })
      });

      expect(storeResponse.status).toBe(200);
      const storeBody = await storeResponse.json();
      expect(storeBody.success).toBe(true);
      expect(storeBody.resumeId).toBe('resume_123');
      expect(repositorySpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      repositorySpy.mockRestore();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    }
  });

  it('runs the orchestration endpoint through the full ingest service path', async () => {
    const ingestSpy = jest.spyOn(ResumeIngestionService.prototype, 'ingestResume').mockResolvedValue({
      success: true,
      message: 'Resume ingestion completed',
      resumeId: 'resume_123',
      data: {
        name: 'Rajesh Mohan Kumar',
        role: 'Test Architect & Senior Agentic Test Engineer',
        company: 'Testleaf Software Solutions Private Limited',
        totalExperience: 13,
        skillsCount: 6,
        embeddingModel: 'mistral-embed',
        embeddingDimension: 1024
      },
      timings: {
        extractMs: 40,
        cleanMs: 5,
        parseMs: 20,
        embeddingMs: 120,
        mongoInsertMs: 30,
        totalMs: 220
      }
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const formData = new FormData();
      formData.append('file', new Blob(['fake pdf'], { type: 'application/pdf' }), 'resume.pdf');

      const response = await fetch(`http://127.0.0.1:${port}/v1/resume/ingest`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.resumeId).toBe('resume_123');
      expect(ingestSpy).toHaveBeenCalledWith(expect.objectContaining({ originalname: 'resume.pdf' }));
    } finally {
      ingestSpy.mockRestore();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    }
  });
});
