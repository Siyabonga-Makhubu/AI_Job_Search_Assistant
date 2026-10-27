import { env } from "../../../config/env";

export interface EmbeddingRequest {
  name?: string | null;
  role?: string | null;
  skills?: string[];
  company?: string | null;
  experienceSummary?: string | null;
  rawText?: string;
}

export class EmbeddingService {
  private buildEmbeddingInput(payload: EmbeddingRequest): string {
    const skills = payload.skills?.join(", ") ?? "";
    const summary = payload.experienceSummary ?? "";
    return [
      payload.name ?? "",
      payload.role ?? "",
      skills,
      payload.company ?? "",
      summary,
      payload.rawText ?? ""
    ].join("\n");
  }

  private createFallbackEmbedding(dimension: number): number[] {
    return Array.from({ length: dimension }, (_, index) => Number((Math.sin(index + 1) * 0.01).toFixed(6)));
  }

  async generateEmbedding(payload: EmbeddingRequest): Promise<{ model: string; dimension: number; embedding: number[] }> {
    const model = env.mistralEmbedModel ?? "mistral-embed";
    const dimension = env.embeddingDimension ?? 1024;
    const inputText = this.buildEmbeddingInput(payload);

    if (!env.mistralApiKey) {
      return { model, dimension, embedding: this.createFallbackEmbedding(dimension) };
    }

    const response = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mistralApiKey}`
      },
      body: JSON.stringify({
        model,
        input: inputText
      })
    });

    if (!response.ok) {
      throw Object.assign(new Error("Mistral embedding failed"), {
        statusCode: 502,
        errorCode: "EMBEDDING_FAILED"
      });
    }

    const json = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = json.data?.[0]?.embedding ?? this.createFallbackEmbedding(dimension);

    return {
      model,
      dimension: embedding.length || dimension,
      embedding
    };
  }
}
