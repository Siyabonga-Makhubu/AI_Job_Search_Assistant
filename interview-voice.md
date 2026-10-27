# Job Assistant — AI Voice Interview Preparation

## Goal

Add an **AI Voice Interviewer** to the existing Job Assistant application.

The interviewer should use the selected job's:

* Job title
* Job description
* Required skills
* Resume RAG match analysis
* Matched skills
* Partial skills
* Not-evidenced skills
* Relevant projects
* Relevant experience
* Interview preparation topics
* Likely discussion areas

to conduct a realistic interview preparation session.

The feature must be **resume-grounded** and must never invent candidate experience, skills, projects, employers, qualifications, or achievements.

---

# 1. User Experience

Add a new section to the existing:

**INTERVIEW PREPARATION**

Current:

```text
INTERVIEW PREPARATION

Prepare for interview

RESUME EVIDENCE ONLY

Suggested topics to prepare for this role.

Technical topics
Generative AI
Python
LLM
RAG
Vector databases
APIs
LLMs

Likely discussion areas
- Explain your RAG architecture
- Explain hybrid retrieval
- Explain MCP
- Explain how you handle hallucinations
```

Add:

```text
AI INTERVIEWER

Practice this interview using your voice.

Job:
AI Engineer - Generative AI

Mode:
Technical Interview

Questions:
10

Difficulty:
Junior / Intermediate

[ Start Voice Interview ]
```

When the user clicks **Start Voice Interview**, open an interview screen.

---

# 2. Interview Screen

Create an interview interface containing:

```text
AI INTERVIEWER

AI Engineer - Generative AI
Hire Feed

Question 3 of 10

"Can you explain how you would design a RAG system for
a production application?"

        🎙️

Listening...

[ Stop Answer ]

--------------------------------

Interview Progress
████████░░ 3 / 10

Topics covered:
✓ RAG
✓ Vector databases
→ System architecture
○ LLMs
○ APIs
○ Hallucination handling

[ End Interview ]
```

The interviewer should speak the question aloud.

The user answers using their microphone.

The application converts the user's speech to text.

The AI evaluates the answer.

Then the next question is generated.

---

# 3. Interview Flow

The interview flow should be:

```text
Selected Job
      ↓
Resume RAG Match
      ↓
Interview Preparation
      ↓
Generate Interview Plan
      ↓
AI generates question
      ↓
Text-to-Speech
      ↓
User speaks
      ↓
Speech-to-Text
      ↓
Answer transcript
      ↓
AI evaluates answer
      ↓
Feedback
      ↓
Next question
      ↓
Final interview report
```

Do not make the interview a simple list of predetermined questions.

Questions should adapt based on:

* Job requirements
* Resume evidence
* Previous answers
* Topics already covered
* Candidate's demonstrated technical depth

---

# 4. Interview Modes

Support these modes:

```text
Technical Interview
Behavioral Interview
Mixed Interview
```

Default:

```text
Mixed Interview
```

For the first version, prioritize:

```text
Technical Interview
```

because the Job Assistant already has technical match information.

---

# 5. Interview Configuration

Allow the user to configure:

```text
Number of questions:
5
10
15

Difficulty:
Junior
Intermediate
Advanced

Interview type:
Technical
Behavioral
Mixed
```

Default:

```text
questions = 10
difficulty = Junior
type = Technical
```

---

# 6. Backend Architecture

Use the existing backend architecture.

Do not create a completely separate AI system.

Reuse:

* Resume RAG services
* Job services
* Match analysis services
* MongoDB
* Groq integration
* Existing authentication/configuration
* Existing REST API structure

Create a new module:

```text
src/modules/interview/
```

Suggested structure:

```text
src/modules/interview/

controllers/
    interviewController.ts

services/
    interviewService.ts
    interviewQuestionService.ts
    interviewEvaluationService.ts
    interviewPromptService.ts

models/
    interviewSession.ts

routes/
    interviewRoutes.ts

types/
    interviewTypes.ts
```

---

# 7. Interview Session Model

Create an interview session stored in MongoDB.

Example:

```typescript
interface InterviewSession {
    _id?: string;

    candidateId?: string;

    jobId: string;

    jobTitle: string;

    company?: string;

    mode: "technical" | "behavioral" | "mixed";

    difficulty: "junior" | "intermediate" | "advanced";

    totalQuestions: number;

    currentQuestion: number;

    status:
        | "created"
        | "in_progress"
        | "completed";

    questions: InterviewQuestion[];

    overallFeedback?: InterviewFeedback;

    createdAt: Date;

    completedAt?: Date;
}
```

Question:

```typescript
interface InterviewQuestion {
    questionNumber: number;

    topic: string;

    question: string;

    expectedAreas: string[];

    answerTranscript?: string;

    evaluation?: InterviewAnswerEvaluation;

    askedAt?: Date;

    answeredAt?: Date;
}
```

Evaluation:

```typescript
interface InterviewAnswerEvaluation {
    relevance: number;

    technicalAccuracy: number;

    clarity: number;

    depth: number;

    grounding: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_EVIDENCED";

    strengths: string[];

    improvements: string[];

    followUpQuestion?: string;
}
```

Do not expose these scores as a candidate "hireability" score.

They are only feedback dimensions for interview preparation.

---

# 8. Interview API

Add:

```text
POST /v1/interviews
```

Creates an interview session.

Request:

```json
{
    "jobId": "123",
    "mode": "technical",
    "difficulty": "junior",
    "totalQuestions": 10
}
```

Response:

```json
{
    "sessionId": "abc123",
    "status": "created"
}
```

---

## Start Interview

```text
POST /v1/interviews/:sessionId/start
```

Response:

```json
{
    "questionNumber": 1,
    "question": "Can you explain what Retrieval-Augmented Generation is?",
    "topic": "RAG"
}
```

---

# 9. Submit Answer

Create:

```text
POST /v1/interviews/:sessionId/answers
```

Request:

```json
{
    "questionNumber": 1,
    "transcript": "RAG is a technique where..."
}
```

The backend should:

1. Save the transcript.
2. Evaluate the answer.
3. Identify strengths.
4. Identify missing areas.
5. Determine whether claims are supported by resume evidence.
6. Generate the next question.

Response:

```json
{
    "evaluation": {
        "relevance": 4,
        "technicalAccuracy": 4,
        "clarity": 3,
        "depth": 3,
        "grounding": "SUPPORTED",
        "strengths": [
            "Correctly explained retrieval and generation."
        ],
        "improvements": [
            "Explain how embeddings are used."
        ]
    },

    "nextQuestion": {
        "questionNumber": 2,
        "topic": "Embeddings",
        "question": "How would embeddings fit into the RAG pipeline?"
    }
}
```

---

# 10. Complete Interview

Create:

```text
POST /v1/interviews/:sessionId/complete
```

Return:

```json
{
    "sessionId": "abc123",
    "status": "completed",
    "feedback": {
        "strengths": [],
        "topicsToReview": [],
        "technicalAreas": [],
        "communicationAreas": [],
        "recommendedPractice": []
    }
}
```

---

# 11. Generate Interview Questions

The AI should receive structured job context.

Example:

```text
JOB:

Title:
AI Engineer - Generative AI

Location:
South Africa - Remote

Requirements:

- Generative AI
- Python
- LLM
- RAG
- Vector databases
- APIs

RESUME MATCH:

Matched:
- Generative AI
- Python
- LLM

Partial:
- None

Not evidenced:
- None

Relevant projects:
- Resume RAG
- Job Assistant
- MCP projects

Interview preparation topics:

- Generative AI
- Python
- LLM
- RAG
- Vector databases
- APIs

Likely discussion areas:

- Explain your RAG architecture
- Explain hybrid retrieval
- Explain MCP
- Explain how you handle hallucinations
```

The model should use this information to generate questions.

---

# 12. Question Generation Rules

The interviewer should ask questions progressively.

Example:

### Question 1 — Fundamentals

```text
What is Retrieval-Augmented Generation and why would you
use it instead of relying only on an LLM's internal knowledge?
```

### Question 2 — Architecture

```text
Can you walk me through the architecture of the RAG system
you worked on?
```

### Question 3 — Retrieval

```text
How does hybrid retrieval combine keyword search and vector
search?
```

### Question 4 — Embeddings

```text
What role do embeddings play in a RAG application?
```

### Question 5 — LLMs

```text
How would you reduce hallucinations in a production LLM
application?
```

### Question 6 — MCP

```text
You mention MCP in your technical skills. Explain what MCP
provides and how you have used it.
```

### Question 7 — APIs

```text
How would you expose your AI functionality through a REST API?
```

### Question 8 — Python

```text
How would you structure a Python service that processes
documents before generating embeddings?
```

Questions should become more specific depending on the candidate's previous answers.

---

# 13. Resume Grounding

This is critical.

The interviewer must distinguish between:

```text
DOCUMENTED
PARTIALLY DOCUMENTED
NOT EVIDENCED
```

For example, if the resume says:

```text
Worked with RAG, embeddings, vector databases and MCP.
```

The interviewer may ask:

```text
Can you explain how you implemented RAG?
```

However, it must NOT say:

```text
You implemented a production RAG system using Pinecone...
```

unless that information actually exists in the Resume RAG evidence.

The AI must never convert a resume skill into an invented project detail.

---

# 14. Handling Unsupported Claims

If the candidate says:

```text
I built a Kubernetes-based RAG platform...
```

but the resume does not contain Kubernetes experience, the interviewer should not accuse the candidate of lying.

Instead:

```text
Thanks. Kubernetes isn't documented in the resume evidence
available to this interview, so I'll treat that as additional
experience you mentioned during the interview.

Let's continue with your documented RAG experience.

How did you approach retrieval in your RAG project?
```

The interview system should preserve this distinction.

---

# 15. AI Evaluation Prompt

Create a dedicated evaluation prompt.

Conceptually:

```text
You are an AI technical interview coach.

Evaluate the candidate's answer against:

1. The interview question
2. The job requirements
3. The provided resume evidence
4. The expected technical concepts

Do not evaluate the candidate as a hiring decision.

Your purpose is interview preparation.

Evaluate:

- Relevance
- Technical accuracy
- Clarity
- Depth
- Grounding

Identify:

- What the candidate explained well
- What could be improved
- Technical concepts they should review
- Whether the answer contains claims that are supported by
  the supplied resume evidence

Never invent candidate experience.

Return structured JSON.
```

---

# 16. Voice Architecture

Implement voice as three independent components:

```text
AI Question
     ↓
Text-to-Speech
     ↓
Browser Audio

Browser Microphone
     ↓
Speech-to-Text
     ↓
Transcript
     ↓
Backend
```

Keep voice processing separate from interview reasoning.

The interview service should work with text regardless of whether the answer came from:

* microphone
* keyboard
* uploaded audio
* future mobile client

This keeps the architecture flexible.

---

# 17. Text-to-Speech

Create a frontend voice service:

```text
src/services/voiceService.ts
```

For the first implementation, use the browser's native:

```text
SpeechSynthesis API
```

Example:

```typescript
export function speak(text: string): void {
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}
```

When the backend returns:

```json
{
    "question": "Explain RAG in simple terms."
}
```

the frontend automatically speaks the question.

---

# 18. Speech-to-Text

Create:

```text
src/services/speechRecognitionService.ts
```

Use browser speech recognition where supported.

The service should expose:

```typescript
startListening();

stopListening();

onTranscript(callback);

onError(callback);

onListeningStateChange(callback);
```

The UI should show:

```text
🎙️ Listening...
```

while recording.

When the user stops:

```text
Your answer:

"RAG retrieves relevant information from a knowledge base
and provides that information to an LLM..."
```

Allow the candidate to edit the transcript before submitting it.

This is important because browser speech recognition can make transcription errors.

---

# 19. Voice Controls

Provide:

```text
🔊 Replay Question
🎙️ Start Answer
⏹ Stop Answer
✏️ Edit Transcript
➡ Submit Answer
```

Also provide:

```text
Mute AI Voice
```

so the user can switch between voice and text.

---

# 20. Interview UI States

Implement these states:

```text
IDLE

STARTING

ASKING

LISTENING

PROCESSING

FEEDBACK

NEXT_QUESTION

COMPLETED
```

Example:

```text
ASKING

AI Interviewer:
"How does hybrid retrieval work?"

🔊 Speaking...
```

Then:

```text
LISTENING

AI Interviewer:

"How does hybrid retrieval work?"

🎙️ Listening...

Your answer:
_________________________

[ Stop Answer ]
```

Then:

```text
PROCESSING

Analysing your answer...
```

Then:

```text
FEEDBACK

Good explanation of vector search.

Consider explaining how BM25 complements
semantic/vector retrieval.

[ Continue ]
```

---

# 21. Adaptive Follow-Up Questions

The interviewer should be able to ask follow-up questions.

Example:

Candidate:

```text
RAG uses embeddings to find relevant documents.
```

AI:

```text
Good start.

What happens after the relevant document chunks
have been retrieved?
```

This makes the interview conversational instead of a static questionnaire.

Limit follow-ups so the interview does not get stuck on one topic.

Example:

```text
maximumFollowUpsPerQuestion = 1
```

---

# 22. Topic Tracking

Maintain a topic tracker.

Example:

```json
{
    "RAG": "covered",
    "embeddings": "covered",
    "vector databases": "partial",
    "LLMs": "not_covered",
    "MCP": "not_covered",
    "APIs": "not_covered"
}
```

Use this to select future questions.

Avoid repeatedly asking about the same topic unless the candidate needs a follow-up.

---

# 23. Interview Difficulty

### Junior

Focus on:

* Definitions
* Basic architecture
* Practical examples
* Basic debugging
* Basic API concepts

Example:

```text
What is an embedding?
```

### Intermediate

Focus on:

* Architecture decisions
* Trade-offs
* Retrieval strategies
* Evaluation
* Performance
* Error handling

Example:

```text
Why might you combine BM25 with vector search?
```

### Advanced

Focus on:

* Production architecture
* Scalability
* Latency
* Cost
* Evaluation
* Observability
* Security
* Failure modes

Example:

```text
How would you design a low-latency hybrid RAG system
for thousands of concurrent users?
```

---

# 24. Final Interview Report

After the final question display:

```text
INTERVIEW COMPLETE

AI Engineer - Generative AI

Topics covered
----------------
RAG
Embeddings
LLMs
Vector databases
APIs
MCP

Strengths
----------------
- Clear explanation of RAG fundamentals
- Good understanding of embeddings
- Connected concepts to practical projects

Topics to review
----------------
- Hybrid retrieval
- Reranking
- RAG evaluation
- Production API architecture

Practice questions
----------------
1. Explain BM25 vs vector search.
2. How would you evaluate RAG quality?
3. How would you reduce LLM hallucinations?
4. How would you monitor an LLM application?

[ Practice Again ]
[ Back to Job ]
```

Do not display:

```text
You have a 78% chance of getting the job.
```

Do not make hiring predictions.

This is an interview preparation tool, not a hiring decision system.

---

# 25. Persist Interview History

Store completed interviews in MongoDB.

Collection:

```text
interview_sessions
```

Store:

```text
jobId
jobTitle
company
mode
difficulty
questions
answers
evaluations
topics
createdAt
completedAt
```

This allows the Saved Jobs page to show:

```text
Saved Jobs

AI Engineer - Generative AI

Status:
✓ Saved
✓ Analysed
✓ Interview Practice

Interview:
Last practiced: Today

[ Continue Interview ]
[ Practice Again ]
```

---

# 26. Saved Job Lifecycle

Integrate with the existing application workflow:

```text
SEARCHED
   ↓
SAVED
   ↓
ANALYSED
   ↓
INTERVIEW PREPARATION
   ↓
APPLICATION
   ↓
INTERVIEW
```

Do not automatically mark a job as "Applied".

Application status must remain controlled by the user.

---

# 27. Suggested Backend Routes

Final API:

```text
/v1/interviews

POST   /
POST   /:sessionId/start
POST   /:sessionId/answers
POST   /:sessionId/complete
GET    /:sessionId
GET    /job/:jobId
```

Example:

```text
POST /v1/interviews
```

Create session.

```text
POST /v1/interviews/abc123/start
```

Generate first question.

```text
POST /v1/interviews/abc123/answers
```

Evaluate answer and generate next question.

```text
POST /v1/interviews/abc123/complete
```

Generate final feedback.

```text
GET /v1/interviews/abc123
```

Retrieve interview.

```text
GET /v1/interviews/job/123
```

Retrieve previous interview sessions for a job.

---

# 28. Reuse Existing Resume RAG

Do not duplicate resume retrieval.

Use the existing Resume RAG services to retrieve:

```text
candidate evidence
skills
projects
experience
education
```

The interview module should consume the existing structured match-analysis output.

Conceptually:

```text
Job Service
     ↓
Match Service
     ↓
Resume RAG
     ↓
Interview Service
```

Not:

```text
Interview Service
     ↓
New Resume Parser
     ↓
New Vector Database
```

---

# 29. Groq / LLM Integration

Reuse the existing Groq configuration.

Do not hard-code API keys.

Use:

```text
GROQ_API_KEY
```

and the existing model configuration.

The model should receive structured JSON/context rather than an unnecessarily large raw prompt.

Keep separate prompts for:

```text
question generation
answer evaluation
follow-up generation
final interview feedback
```

---

# 30. Structured LLM Responses

Prefer structured output.

Example question:

```json
{
    "topic": "RAG",
    "question": "Explain Retrieval-Augmented Generation.",
    "expectedAreas": [
        "retrieval",
        "context",
        "LLM generation",
        "grounding"
    ]
}
```

Example evaluation:

```json
{
    "relevance": 4,
    "technicalAccuracy": 4,
    "clarity": 3,
    "depth": 3,
    "grounding": "SUPPORTED",
    "strengths": [
        "Explained retrieval correctly"
    ],
    "improvements": [
        "Explain how embeddings enable semantic retrieval"
    ],
    "topicsToReview": [
        "embeddings"
    ]
}
```

Validate LLM output before returning it to the frontend.

---

# 31. Error Handling

Handle:

```text
Microphone permission denied
Speech recognition unavailable
Speech recognition stopped unexpectedly
LLM request failed
Interview session expired
Job no longer exists
Resume evidence unavailable
Invalid interview configuration
```

Example:

```text
Microphone access is unavailable.

You can still type your answer below.
```

The interview must remain usable without voice.

---

# 32. Security

Never expose:

```text
GROQ_API_KEY
```

to the frontend.

Voice processing should not send unnecessary personal information to third-party services.

Only send the data required for the interview:

```text
job context
resume evidence
interview question
candidate answer
```

Avoid sending the entire resume when only specific evidence is required.

---

# 33. Privacy

Display a small notice:

```text
Voice Interview Privacy

Your microphone is used to capture your interview answers.
Your transcript is sent to the configured AI service for
interview feedback.

Do not provide passwords, financial information, or other
sensitive personal information during the interview.
```

If audio is not stored, explicitly state:

```text
Audio is not stored. Only the answer transcript is saved
with the interview session.
```

Only make this claim if the implementation actually does not store audio.

---

# 34. Frontend Components

Create:

```text
components/interview/

InterviewPreparationCard.tsx
InterviewSetup.tsx
InterviewSession.tsx
InterviewQuestion.tsx
VoiceControls.tsx
AnswerTranscript.tsx
AnswerFeedback.tsx
InterviewProgress.tsx
InterviewSummary.tsx
TopicProgress.tsx
```

Suggested component hierarchy:

```text
InterviewPreparationCard
        |
        └── InterviewSetup
                |
                └── InterviewSession
                        |
                        ├── InterviewProgress
                        ├── InterviewQuestion
                        ├── VoiceControls
                        ├── AnswerTranscript
                        └── AnswerFeedback
                                |
                                └── InterviewSummary
```

---

# 35. Do Not Break Existing Features

This implementation must preserve:

```text
Job discovery
Saved jobs
Resume ingestion
Resume parsing
Resume embeddings
BM25 search
Vector search
Hybrid retrieval
Match analysis
Candidate evidence
AI Interview Coach
Application Assistant
MCP integration
```

The new interview functionality should be additive.

Do not replace the existing AI Interview Coach.

Instead:

```text
AI INTERVIEW COACH
    ↓
Learn concepts / ask questions

AI VOICE INTERVIEWER
    ↓
Practice answering questions
```

These are two different experiences.

---

# 36. MCP Integration

If the project already exposes MCP tools, optionally add:

```text
start_interview
get_interview_question
submit_interview_answer
get_interview_feedback
complete_interview
```

These tools should call the same underlying services as REST.

Architecture:

```text
             ┌── REST API ────────┐
             │                    │
Job/Resume → Interview Service ←──┤
             │                    │
             └── MCP Tools ──────┘
```

Do not duplicate interview logic inside the MCP server.

---

# 37. Implementation Order

Implement in phases.

## Phase 1 — Backend

Implement:

```text
InterviewSession model
Interview service
Question generation
Answer evaluation
Interview routes
MongoDB persistence
```

Test with Postman/curl before touching voice.

---

## Phase 2 — Frontend Text Interview

Implement:

```text
Interview setup
Question display
Text answer input
Answer submission
Feedback
Next question
Final summary
```

Verify the entire interview works without voice.

---

## Phase 3 — Text-to-Speech

Add:

```text
SpeechSynthesis API
```

Automatically read interview questions.

Add:

```text
Replay Question
Mute Voice
```

---

## Phase 4 — Speech-to-Text

Add microphone support.

Implement:

```text
Start Answer
Stop Answer
Transcript
Edit Transcript
Submit Answer
```

Ensure text fallback works.

---

## Phase 5 — Adaptive Interviews

Add:

```text
topic tracking
follow-up questions
difficulty
answer-aware question generation
```

---

## Phase 6 — Interview History

Add:

```text
previous interviews
continue interview
practice again
interview history per saved job
```

---

## Phase 7 — MCP

Expose the interview service through the existing MCP architecture.

---

# 38. Testing Requirements

Add backend tests for:

```text
POST /v1/interviews
POST /v1/interviews/:id/start
POST /v1/interviews/:id/answers
POST /v1/interviews/:id/complete
GET /v1/interviews/:id
```

Test:

```text
valid job
invalid job
missing resume evidence
empty answer
very long answer
LLM failure
invalid LLM JSON
completed session
duplicate answer submission
```

Frontend tests should verify:

```text
Start interview
Question displayed
Voice starts
Voice stops
Transcript displayed
Transcript editable
Answer submitted
Feedback displayed
Next question
Interview completed
Text fallback
```

---

# 39. Important Grounding Rule

The AI interviewer must follow this rule:

```text
The resume tells us what is documented.

The interview tells us what the candidate says.

These are not the same source of truth.
```

Therefore:

```text
Resume evidence:
"Python"

Candidate says:
"I have used Python with FastAPI."

```

The system can record:

```text
Candidate stated additional experience with FastAPI.
```

but should not rewrite the resume evidence as:

```text
Resume proves FastAPI experience.
```

This distinction should remain visible in interview feedback.

---

# 40. Final User Experience

The completed workflow should look like:

```text
JOB SEARCH
     ↓
Find AI Engineer jobs
     ↓
SAVE JOB
     ↓
RESUME RAG MATCH
     ↓
Matched / Partial / Not Evidenced
     ↓
INTERVIEW PREPARATION
     ↓
┌─────────────────────────────┐
│ AI INTERVIEW COACH          │
│                             │
│ Learn RAG                   │
│ Learn hybrid retrieval      │
│ Learn MCP                   │
└─────────────────────────────┘
     ↓
┌─────────────────────────────┐
│ AI VOICE INTERVIEWER        │
│                             │
│ 🎙 "Tell me about your RAG  │
│     architecture."          │
│                             │
│ 🎤 User answers             │
│                             │
│ AI evaluates answer         │
│                             │
│ Follow-up question          │
└─────────────────────────────┘
     ↓
INTERVIEW SUMMARY
     ↓
Topics to Review
     ↓
Practice Again
```

# 41. Acceptance Criteria

The implementation is complete when:

* [ ] A user can select a saved/analyzed job.
* [ ] The interview uses that job's requirements.
* [ ] The interview uses Resume RAG evidence.
* [ ] Questions are generated dynamically.
* [ ] Questions can adapt to previous answers.
* [ ] The AI interviewer speaks questions aloud.
* [ ] The user can answer through a microphone.
* [ ] Speech is converted to a transcript.
* [ ] The user can edit the transcript.
* [ ] The answer is evaluated by the backend.
* [ ] Feedback is displayed after each answer.
* [ ] Follow-up questions are supported.
* [ ] Topics are tracked.
* [ ] A final interview summary is generated.
* [ ] Interview sessions are stored in MongoDB.
* [ ] Previous interview sessions can be viewed.
* [ ] Text input remains available if voice is unavailable.
* [ ] No API keys are exposed in the frontend.
* [ ] No candidate experience is invented.
* [ ] Resume evidence and candidate-stated experience remain separate.
* [ ] Existing Job Search functionality continues working.
* [ ] Existing Resume RAG functionality continues working.
* [ ] Existing Match Analysis continues working.
* [ ] Existing AI Interview Coach continues working.
* [ ] Existing Application Assistant continues working.
* [ ] MCP, if enabled, reuses the same interview services.

# 42. First Implementation Instruction

Implement **Phase 1 only first**.

Do not implement the microphone or voice functionality until the text-based interview flow works end-to-end.

The first milestone should be:

```text
Job
 ↓
Resume Match
 ↓
Create Interview
 ↓
Generate Question
 ↓
User types answer
 ↓
AI evaluates answer
 ↓
Generate next question
 ↓
Complete interview
 ↓
Final feedback
 ↓
Save session to MongoDB
```

Once this works, implement the voice layer on top of the existing interview API.

The voice layer must not contain interview/business logic.
