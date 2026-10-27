"""Unit tests for DeepEval job-case construction and normalized results."""

from __future__ import annotations

import contextlib
import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch

from deepeval.test_case import LLMTestCase

from deepeval_job_eval import (
    build_job_answer_test_case,
    build_job_test_case,
    evaluate,
    main,
    parse_metric_result,
)


def sample_job(job_id: str = "job-1") -> dict[str, object]:
    return {
        "jobId": job_id,
        "title": "Junior AI Engineer",
        "company": "Example Co",
        "location": "Cape Town",
        "remote": True,
        "description": "Build retrieval augmented generation services.",
        "requiredSkills": ["Python", "RAG"],
    }


class DeepEvalJobEvalTests(unittest.TestCase):
    def test_job_test_case_contains_query_summary_and_text_context(self) -> None:
        case = build_job_test_case("Junior RAG engineer", sample_job())

        self.assertIsInstance(case, LLMTestCase)
        self.assertEqual(case.input, "Junior RAG engineer")
        self.assertIn("Junior AI Engineer", case.actual_output)
        self.assertIn("Example Co", case.actual_output)
        self.assertIn("Python, RAG", case.actual_output)
        self.assertIn("retrieval augmented generation", case.actual_output)
        self.assertIsNotNone(case.retrieval_context)
        self.assertTrue(any("Location: Cape Town" in field for field in case.retrieval_context or []))

    def test_job_answer_test_case_uses_generated_answer_and_listing_as_context(self) -> None:
        case = build_job_answer_test_case("AI engineer", sample_job(), "This AI role uses Python.")

        self.assertEqual(case.input, "AI engineer")
        self.assertEqual(case.actual_output, "This AI role uses Python.")
        self.assertIsNotNone(case.retrieval_context)
        self.assertTrue(any("Python, RAG" in field for field in case.retrieval_context or []))

    def test_result_parser_marks_threshold_and_preserves_failure_reason(self) -> None:
        result = parse_metric_result(
            query="AI engineer",
            job=sample_job(),
            metric_name="Job-Query Alignment",
            score=0.69,
            threshold=0.7,
            reason="The seniority does not match.",
            judge_model="test-model",
            timestamp="2026-10-15T10:00:00+00:00",
        )

        self.assertFalse(result["passed"])
        self.assertEqual(result["score"], 0.69)
        self.assertEqual(result["reason"], "The seniority does not match.")
        self.assertEqual(result["jobId"], "job-1")
        self.assertEqual(result["timestamp"], "2026-10-15T10:00:00+00:00")

    def test_worker_output_is_ascii_safe_and_preserves_unicode(self) -> None:
        expected = [{"reason": "A non-breaking hyphen: \u2011"}]
        stdout = io.StringIO()
        with (
            patch("sys.stdin", io.StringIO("{}")),
            patch("deepeval_job_eval.evaluate", return_value=expected),
            contextlib.redirect_stdout(stdout),
        ):
            main()

        output = stdout.getvalue()
        output.encode("ascii")
        self.assertEqual(json.loads(output), expected)

    @patch("deepeval_job_eval.GroqJudge")
    @patch("deepeval_job_eval.FaithfulnessMetric")
    @patch("deepeval_job_eval.ContextualRelevancyMetric")
    @patch("deepeval_job_eval.GEval")
    def test_evaluation_returns_all_job_metrics_when_one_measure_fails(
        self,
        geval_class: MagicMock,
        relevancy_class: MagicMock,
        faithfulness_class: MagicMock,
        judge_class: MagicMock,
    ) -> None:
        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}):
            judge_class.return_value.generate.return_value = "A junior AI role using Python and RAG."
            relevancy = MagicMock()
            relevancy.measure.side_effect = RuntimeError("mocked judge error")
            relevancy_class.return_value = relevancy
            faithfulness = MagicMock(score=0.8, reason="The claims are supported by the listing.")
            faithfulness_class.return_value = faithfulness
            alignment = MagicMock(score=0.9, reason="Strong role match.")
            geval_class.return_value = alignment

            results = evaluate({
                "query": "Junior AI Engineer",
                "jobs": [sample_job()],
                "evaluateMetricsByJob": {
                    "job-1": ["Contextual Relevancy", "Faithfulness", "Job-Query Alignment"],
                },
            })

        self.assertEqual(len(results), 3)
        self.assertEqual(results[0]["error"], "mocked judge error")
        self.assertEqual(results[0]["metricName"], "Contextual Relevancy")
        self.assertEqual(results[0]["jobId"], "job-1")
        self.assertTrue(results[1]["passed"])
        self.assertEqual(results[1]["metricName"], "Faithfulness")
        self.assertEqual(results[1]["jobId"], "job-1")
        self.assertEqual(results[1]["generatedAnswer"], "A junior AI role using Python and RAG.")
        self.assertTrue(results[2]["passed"])
        geval_class.assert_called_once()
        self.assertNotIn("include_reason", geval_class.call_args.kwargs)
        faithfulness.measure.assert_called_once()
