# Resume Retrieval Module

This retrieval module reads the resumes created by the ingestion pipeline.
It does not ingest or modify resume documents.

The retrieval workflow is:

1. Validate the user query
2. Normalize the search text
3. Generate a query embedding with the same Mistral model used during ingestion
4. Search stored resume embeddings
5. Apply optional metadata filters
6. Re-rank candidates
7. Generate a grounded answer from the retrieved evidence
8. Return result sources and timings

The module reuses the shared MongoDB connection and resume collection created by ingestion.
