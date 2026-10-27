import { ChatGroq, type ChatGroqInput } from "@langchain/groq";
import { env } from "./env";

/** Build the shared chat model used by all application LLM features. */
export function createChatModel(options: Partial<Omit<ChatGroqInput, "model" | "apiKey">> = {}): ChatGroq {
  if (!env.groqApiKey) {
    throw Object.assign(new Error("GROQ_API_KEY is not configured"), { errorCode: "LLM_NOT_CONFIGURED" });
  }

  return new ChatGroq({
    ...options,
    apiKey: env.groqApiKey,
    model: env.groqModel,
  });
}
