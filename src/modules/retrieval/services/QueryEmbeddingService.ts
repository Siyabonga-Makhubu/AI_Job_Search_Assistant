import { env } from "../../../config/env";

export class QueryEmbeddingService {
  async embedText(query: string): Promise<number[]> {
    const inputText = (query ?? "").trim();

    if (!inputText) {
      throw Object.assign(new Error("Query cannot be empty"), {
        statusCode: 400,
        errorCode: "QUERY_EMBEDDING_INVALID"
      });
    }

    if (!env.mistralApiKey) {
      throw Object.assign(
        new Error("Mistral API key is not configured"),
        {
          statusCode: 500,
          errorCode: "QUERY_EMBEDDING_INVALID"
        }
      );
    }

    const response = await fetch(
      "https://api.mistral.ai/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.mistralApiKey}`
        },
        body: JSON.stringify({
          model: env.mistralEmbedModel ?? "mistral-embed",
          input: inputText
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("Mistral query embedding error:", errorBody);

      throw Object.assign(
        new Error("Query embedding failed"),
        {
          statusCode: 502,
          errorCode: "QUERY_EMBEDDING_FAILED"
        }
      );
    }

    const json = (await response.json()) as {
      data?: Array<{
        embedding?: number[];
      }>;
    };

    const embedding = json.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw Object.assign(
        new Error("Mistral returned an invalid query embedding"),
        {
          statusCode: 502,
          errorCode: "QUERY_EMBEDDING_INVALID"
        }
      );
    }

    const expectedDimension = env.embeddingDimension || 1024;

    if (embedding.length !== expectedDimension) {
      throw Object.assign(
        new Error(
          "Query embedding dimension does not match resume embeddings"
        ),
        {
          statusCode: 500,
          errorCode: "QUERY_EMBEDDING_INVALID"
        }
      );
    }

    return embedding;
  }
}