# Resume RAG Job Assistant

React, TypeScript, and Vite frontend for the existing Resume RAG job APIs.

## Run locally

From the repository root, create/configure `.env` from `.env.example` and install the Python evaluation dependencies into the existing virtual environment:

```powershell
.\venv\Scripts\python.exe -m pip install -r evaluation\requirements.txt
```

Set `GROQ_API_KEY` in `.env` for the existing LLM features and DeepEval judge. DeepEval runs are disabled by default because they call an LLM and may incur API usage. Set the following in `.env` to enable them:

```dotenv
DEEPEVAL_ENABLED=true
DEEPEVAL_JUDGE_MODEL=openai/gpt-oss-120b
DEEPEVAL_ALIGNMENT_THRESHOLD=0.7
DEEPEVAL_RELEVANCY_THRESHOLD=0.7
DEEPEVAL_MAX_JOBS=10
```

The judge model is sent through the configured Groq API key. If needed, set `DEEPEVAL_PYTHON` to the Python interpreter that has `evaluation/requirements.txt` installed.

Start the backend from the repository root:

```sh
npm run dev
```

Then start the frontend from this directory:

```sh
npm run dev
```

Vite serves the frontend on port `4173` and proxies `/v1` requests to `http://localhost:3000`. To use another backend origin, set `VITE_API_BASE_URL` in a local `.env` file. This value is public in the browser and must not contain secrets.

## DeepEval Metrics

Open [http://localhost:4173/evaluation](http://localhost:4173/evaluation), or choose **DeepEval Metrics** from the sidebar. Run a job search first, then run the evaluation against the currently retrieved jobs. Query-level contextual relevancy and per-job Job-Query Alignment results, including reasons, are persisted in MongoDB for history. Identical query/job/model/metric evaluations reuse cached scores.

Thresholds and the maximum number of jobs are configurable through the environment variables above. Contextual precision and recall are not run because the current job data has no expected-output labels or other ground truth.

Run the evaluator's unit tests without an API key:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s evaluation -p "test_*.py"
```

## Available checks

```sh
npm run build
npm run lint
```

The frontend package does not currently define a test script.
