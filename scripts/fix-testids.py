"""
Fix missing data-testid attributes in App.tsx:
  1. job-empty-state  — both null-results and empty-results divs
  2. job-results-grid — the job cards container div
"""

with open("frontend/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

print(f"File length: {len(content)} chars")

# ── 1. Empty state when results is null (initial state) ──────────────────────
old1 = '<div className="empty-card"><div className="empty-icon"><Search size={22} /></div><strong>Start with a job search</strong>'
new1 = '<div data-testid="job-empty-state" className="empty-card"><div className="empty-icon"><Search size={22} /></div><strong>Start with a job search</strong>'
if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Replaced: initial empty-card (no results)")
else:
    print("NOT FOUND: initial empty-card")

# ── 2. Empty state when results is an empty array ────────────────────────────
old2 = '<div className="empty-card"><div className="empty-icon"><Search size={22} /></div><strong>No jobs found</strong>'
new2 = '<div data-testid="job-empty-state" className="empty-card"><div className="empty-icon"><Search size={22} /></div><strong>No jobs found</strong>'
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Replaced: empty-card (no results found)")
else:
    print("NOT FOUND: empty-card (no results found)")

# ── 3. Results grid ───────────────────────────────────────────────────────────
old3 = '<div className="job-grid">'
new3 = '<div data-testid="job-results-grid" className="job-grid">'
if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Replaced: job-grid -> job-results-grid")
else:
    print("NOT FOUND: job-grid div")

with open("frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done.")
