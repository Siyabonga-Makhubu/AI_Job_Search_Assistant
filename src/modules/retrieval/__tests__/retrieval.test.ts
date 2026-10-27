/// <reference types="jest" />

import { normalizeQuery } from '../utils/queryNormalizer';
import { MetadataFilterService } from '../services/MetadataFilterService';
import { QueryEmbeddingService } from '../services/QueryEmbeddingService';
import { RerankingService } from '../services/RerankingService';
import { ContextBuilder } from '../services/ContextBuilder';
import { app } from '../../../app';

describe('resume retrieval utilities', () => {
  it('normalizes search queries without destroying technical terms', () => {
    const value = normalizeQuery('   Find   candidates with PYTHON, RAG and Selenium experience!!! ');
    expect(value).toBe('Find candidates with PYTHON, RAG and Selenium experience!!!');
  });

  it('builds metadata filters for skill and experience requirements', () => {
    const filter = new MetadataFilterService().buildMongoFilter({
      skills: ['Python', 'RAG'],
      minimumExperience: 5
    });

    expect(filter).toEqual({
      skills: { $all: ['Python', 'RAG'] },
      totalExperience: { $gte: 5 }
    });
  });

  it('returns a 1024-dimensional embedding vector for query text', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: Array.from({ length: 1024 }, (_, index) => index / 1000) }] })
    }) as any;

    try {
      const embedding = await new QueryEmbeddingService().embedText('Python RAG developer');
      expect(embedding).toHaveLength(1024);
      expect(embedding[0]).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('reranks candidates with weighted relevance', () => {
    const score = new RerankingService().rerank({
      vectorScore: 0.85,
      skillMatchScore: 1,
      experienceScore: 0.9,
      roleScore: 0.8
    });

    expect(score).toBeGreaterThan(0.8);
  });

  it('builds a safe retrieval context from candidate data', () => {
    const context = new ContextBuilder().buildContext([
      {
        resumeId: 'candidate-1',
        name: 'Rajesh Mohan Kumar',
        role: 'Test Architect',
        company: 'Testleaf',
        skills: ['Python', 'RAG'],
        totalExperience: 13,
        score: 0.86
      }
    ]);

    expect(context).toContain('Candidate ID: candidate-1');
    expect(context).toContain('Rajesh Mohan Kumar');
    expect(context).toContain('Python');
  });

  it('exposes the retrieval health endpoint on the shared app server', async () => {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/retrieval/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: 'ok', module: 'resume-retrieval' });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    }
  });
});
