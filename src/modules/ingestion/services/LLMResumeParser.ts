import { parseResume, type ParsedResume } from "./AlgorithmResumeParser";
import { env } from "../../../config/env";

export class LLMResumeParser {
  async parseResume(rawText: string): Promise<ParsedResume> {
    if (!env.useLlmParser) {
      throw Object.assign(new Error("LLM resume parser is disabled"), {
        statusCode: 400,
        errorCode: "LLM_PARSER_DISABLED"
      });
    }

    return parseResume(rawText);
  }
}
