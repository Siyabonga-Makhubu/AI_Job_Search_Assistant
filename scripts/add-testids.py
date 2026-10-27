"""Add data-testid attributes to DeepEvalMetrics.tsx."""

with open("frontend/src/DeepEvalMetrics.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
        '<select value={metricFilter}',
        '<select data-testid="deepeval-metric-filter" value={metricFilter}',
    ),
    (
        '<select value={passFilter}',
        '<select data-testid="deepeval-pass-filter" value={passFilter}',
    ),
    (
        'className="deepeval-table">',
        'data-testid="deepeval-results-table" className="deepeval-table">',
    ),
    (
        "<div className=\"deepeval-empty\">",
        '<div data-testid="deepeval-empty-state" className="deepeval-empty">',
    ),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"Replaced: {old[:60]}")
    else:
        print(f"NOT FOUND: {old[:60]}")

with open("frontend/src/DeepEvalMetrics.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done.")
