import { createChatModel } from "../../../config/chatModel";
import { InterviewQuestionService } from "../services/interviewQuestionService";

jest.mock("../../../config/chatModel", () => ({ createChatModel: jest.fn() }));

const createChatModelMock = jest.mocked(createChatModel);

function setModelResponse(content: unknown) {
  const invoke = jest.fn().mockResolvedValue({ content });
  createChatModelMock.mockReturnValue({ invoke } as unknown as ReturnType<typeof createChatModel>);
  return invoke;
}

describe("InterviewQuestionService.generateJson", () => {
  beforeEach(() => createChatModelMock.mockReset());

  it("parses JSON returned as text blocks", async () => {
    const invoke = setModelResponse([{ type: "text", text: '{"grounding":"SUPPORTED"}' }]);

    await expect(new InterviewQuestionService().generateJson("prompt")).resolves.toEqual({ grounding: "SUPPORTED" });
    expect(invoke).toHaveBeenCalledWith(expect.any(Array), { response_format: { type: "json_object" } });
  });

  it("parses JSON surrounded by explanatory text and a Markdown fence", async () => {
    setModelResponse('Here is the evaluation:\n```json\n{"grounding":"SUPPORTED"}\n```');

    await expect(new InterviewQuestionService().generateJson("prompt")).resolves.toEqual({ grounding: "SUPPORTED" });
  });

  it("returns a retryable safe error when the model returns malformed JSON", async () => {
    setModelResponse("not json");

    await expect(new InterviewQuestionService().generateJson("prompt")).rejects.toMatchObject({
      statusCode: 502,
      errorCode: "INVALID_LLM_JSON",
      message: expect.stringContaining("Your answer was not submitted"),
    });
  });

  it("classifies provider quota errors without exposing provider details", async () => {
    const invoke = jest.fn().mockRejectedValue(Object.assign(new Error("account quota exceeded"), { status: 429 }));
    createChatModelMock.mockReturnValue({ invoke } as unknown as ReturnType<typeof createChatModel>);

    await expect(new InterviewQuestionService().generateJson("prompt")).rejects.toMatchObject({
      statusCode: 429,
      errorCode: "LLM_QUOTA_EXCEEDED",
      message: expect.stringContaining("usage limit"),
    });
  });
});