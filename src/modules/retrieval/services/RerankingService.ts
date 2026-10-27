export interface RerankInput {
  vectorScore: number;
  skillMatchScore: number;
  experienceScore: number;
  roleScore: number;
}

export class RerankingService {
  rerank(input: RerankInput): number {
    return (
      0.5 * (Number.isFinite(input.vectorScore) ? input.vectorScore : 0) +
      0.25 * (Number.isFinite(input.skillMatchScore) ? input.skillMatchScore : 0) +
      0.15 * (Number.isFinite(input.experienceScore) ? input.experienceScore : 0) +
      0.1 * (Number.isFinite(input.roleScore) ? input.roleScore : 0)
    );
  }
}
