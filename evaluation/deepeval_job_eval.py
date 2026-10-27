"""DeepEval evaluation runner for retrieved job listings."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

from deepeval.metrics import ContextualRelevancyMetric, FaithfulnessMetric, GEval
from deepeval.models import DeepEvalBaseLLM
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from openai import AsyncOpenAI, OpenAI
from pydantic import BaseModel


def _job_fields(job: dict[str, Any]) -> list[str]:
    """Return the non-empty searchable text fields for a job."""
    fields = [
        ("Title", job.get("title")),
        ("Company", job.get("company")),
        ("Location", job.get("location")),
        ("Remote", "Yes" if job.get("remote") is True else "No" if job.get("remote") is False else None),
        ("Employment type", job.get("employmentType")),
        ("Description", job.get("description")),
    ]
    for key in (
        "requiredSkills",
        "preferredSkills",
        "technologies",
        "responsibilities",
        "qualifications",
        "experienceRequirements",
        "educationRequirements",
    ):
        value = job.get(key)
        if isinstance(value, list):
            fields.append((key, ", ".join(str(item) for item in value if item)))
    return [
        f"{label}: {str(value)[:1200] if label == 'Description' else value}"
        for label, value in fields
        if value
    ]


def build_job_test_case(query: str, job: dict[str, Any]) -> LLMTestCase:
    """Build the per-job alignment case from one query and one retrieved job."""
    fields = _job_fields(job)
    return LLMTestCase(
        input=query,
        actual_output="\n".join(fields),
        retrieval_context=fields,
    )


def build_job_answer_test_case(query: str, job: dict[str, Any], answer: str) -> LLMTestCase:
    """Build a case for checking a generated job summary against its listing."""
    return LLMTestCase(
        input=query,
        actual_output=answer,
        retrieval_context=_job_fields(job),
    )


def parse_metric_result(
    *,
    query: str,
    job: dict[str, Any] | None,
    metric_name: str,
    score: float | None,
    threshold: float,
    reason: str | None,
    judge_model: str,
    timestamp: str | None = None,
    error: str | None = None,
    generated_answer: str | None = None,
) -> dict[str, Any]:
    """Normalize a DeepEval metric into the result document contract."""
    valid_score = score if score is not None and 0 <= score <= 1 else None
    return {
        "query": query,
        "jobId": job.get("jobId") if job else None,
        "jobTitle": job.get("title") if job else None,
        "company": job.get("company") if job else None,
        "metricName": metric_name,
        "score": valid_score,
        "threshold": threshold,
        "passed": valid_score is not None and valid_score >= threshold,
        "reason": reason,
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
        "judgeModel": judge_model,
        **({"error": error} if error else {}),
        **({"generatedAnswer": generated_answer} if generated_answer else {}),
    }


class GroqJudge(DeepEvalBaseLLM):
    """DeepEval-compatible judge backed by the configured Groq OpenAI API."""

    def __init__(self, model_name: str, api_key: str) -> None:
        self._configured_model_name = model_name
        self._api_key = api_key
        super().__init__(model=model_name)

    def load_model(self) -> OpenAI:
        return OpenAI(
            api_key=self._api_key,
            base_url="https://api.groq.com/openai/v1",
            timeout=90,
        )

    def get_model_name(self) -> str:
        return self._configured_model_name

    def generate(self, prompt: str, schema: type[BaseModel] | None = None) -> str | BaseModel:
        response = self.model.chat.completions.create(
            model=self._configured_model_name,
            messages=[{"role": "user", "content": prompt}],
            **({"response_format": {"type": "json_object"}} if schema else {}),
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("The DeepEval judge returned an empty response")
        return schema.model_validate_json(content) if schema else content

    async def a_generate(self, prompt: str, schema: type[BaseModel] | None = None) -> str | BaseModel:
        async with AsyncOpenAI(
            api_key=self._api_key,
            base_url="https://api.groq.com/openai/v1",
            timeout=90,
        ) as client:
            response = await client.chat.completions.create(
                model=self._configured_model_name,
                messages=[{"role": "user", "content": prompt}],
                **({"response_format": {"type": "json_object"}} if schema else {}),
            )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("The DeepEval judge returned an empty response")
        return schema.model_validate_json(content) if schema else content


def evaluate(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Evaluate relevance, faithfulness, and alignment for requested jobs."""
    query = str(payload["query"])
    input_query = str(payload.get("inputQuery") or query)
    jobs = payload.get("jobs", [])
    metrics_by_job = payload.get("evaluateMetricsByJob", {})
    judge_model = str(payload.get("judgeModel") or os.environ.get("DEEPEVAL_JUDGE_MODEL", "openai/gpt-oss-120b"))
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY must be configured to run DeepEval")

    judge = GroqJudge(judge_model, api_key)
    alignment_threshold = float(payload.get("alignmentThreshold", os.environ.get("DEEPEVAL_ALIGNMENT_THRESHOLD", "0.7")))
    relevancy_threshold = float(payload.get("relevancyThreshold", os.environ.get("DEEPEVAL_RELEVANCY_THRESHOLD", "0.7")))
    faithfulness_threshold = float(payload.get("faithfulnessThreshold", os.environ.get("DEEPEVAL_FAITHFULNESS_THRESHOLD", "0.7")))
    results: list[dict[str, Any]] = []

    for job in jobs:
        requested_metrics = set(metrics_by_job.get(job.get("jobId"), []))
        if not requested_metrics:
            continue

        generated_answer: str | None = None
        answer_case: LLMTestCase | None = None
        answer_metrics = [
            metric_name
            for metric_name in ("Contextual Relevancy", "Faithfulness")
            if metric_name in requested_metrics
        ]
        if answer_metrics:
            try:
                listing = "\n".join(_job_fields(job))
                candidate_answer = judge.generate(
                    "Answer the user's job-search query using only the supplied job listing. "
                    "Write a concise, factual summary of how this specific listing relates to "
                    "the query. Do not add facts that are not in the listing.\n\n"
                    f"User query:\n{input_query}\n\nJob listing:\n{listing}"
                )
                if not isinstance(candidate_answer, str):
                    raise TypeError("The DeepEval judge must return a text job summary")
                if not candidate_answer.strip():
                    raise RuntimeError("The DeepEval judge returned an empty job summary")
                generated_answer = candidate_answer.strip()
                answer_case = build_job_answer_test_case(input_query, job, generated_answer)
            except Exception as exc:  # Report answer-generation failures for dependent metrics.
                for metric_name in answer_metrics:
                    threshold = relevancy_threshold if metric_name == "Contextual Relevancy" else faithfulness_threshold
                    results.append(parse_metric_result(
                        query=query,
                        job=job,
                        metric_name=metric_name,
                        score=None,
                        threshold=threshold,
                        reason=str(exc),
                        judge_model=judge_model,
                        error=str(exc),
                    ))

        if answer_case is not None:
            answer_metric_classes = {
                "Contextual Relevancy": (ContextualRelevancyMetric, relevancy_threshold),
                "Faithfulness": (FaithfulnessMetric, faithfulness_threshold),
            }
            for metric_name in answer_metrics:
                metric_class, threshold = answer_metric_classes[metric_name]
                try:
                    metric = metric_class(
                        threshold=threshold,
                        include_reason=True,
                        async_mode=True,
                        model=judge,
                    )
                    metric.measure(answer_case)
                    results.append(parse_metric_result(
                        query=query,
                        job=job,
                        metric_name=metric_name,
                        score=metric.score,
                        threshold=threshold,
                        reason=metric.reason,
                        judge_model=judge_model,
                        generated_answer=generated_answer,
                    ))
                except Exception as exc:  # Keep one judge metric failure from hiding the others.
                    results.append(parse_metric_result(
                        query=query,
                        job=job,
                        metric_name=metric_name,
                        score=None,
                        threshold=threshold,
                        reason=str(exc),
                        judge_model=judge_model,
                        error=str(exc),
                        generated_answer=generated_answer,
                    ))

        if "Job-Query Alignment" not in requested_metrics:
            continue
        try:
            metric = GEval(
                name="Job-Query Alignment",
                criteria=(
                    "Score how well the job matches the user's search intent. Consider the "
                    "job title and role match, required skills, seniority level, the location "
                    "and remote preference stated in the query, and relevant industry. Do not "
                    "assume missing information is a match. Give a score from 0 to 1."
                ),
                evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
                threshold=alignment_threshold,
                async_mode=True,
                model=judge,
            )
            metric.measure(build_job_test_case(input_query, job))
            results.append(parse_metric_result(
                query=query,
                job=job,
                metric_name="Job-Query Alignment",
                score=metric.score,
                threshold=alignment_threshold,
                reason=metric.reason,
                judge_model=judge_model,
            ))
        except Exception as exc:  # Continue so a single bad listing does not stop the batch.
            results.append(parse_metric_result(
                query=query,
                job=job,
                metric_name="Job-Query Alignment",
                score=None,
                threshold=alignment_threshold,
                reason=str(exc),
                judge_model=judge_model,
                error=str(exc),
            ))
    return results


def main() -> None:
    """Read one JSON payload from stdin and write structured results to stdout."""
    payload = json.load(sys.stdin)
    print(json.dumps(evaluate(payload), ensure_ascii=True))


if __name__ == "__main__":
    main()
