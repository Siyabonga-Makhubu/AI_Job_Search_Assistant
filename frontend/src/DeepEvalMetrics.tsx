import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LoaderCircle, Play, RefreshCw } from 'lucide-react'
import { jobsApi } from './services/jobsApi'
import type { EvaluationMetricName, EvaluationResult, EvaluationSettings, JobSearchResult } from './types/jobs'
import './DeepEvalMetrics.css'

type Props = {
  query: string
  jobs: JobSearchResult[]
}
type ResultRow = {
  key: string
  runId: string
  query: string
  jobId: string | null
  jobTitle: string
  company: string
  timestamp: string
  contextual?: EvaluationResult
  faithfulness?: EvaluationResult
  alignment?: EvaluationResult
}

const metricNames: EvaluationMetricName[] = ['Contextual Relevancy', 'Faithfulness', 'Job-Query Alignment']

export function DeepEvalMetrics({ query: currentQuery, jobs }: Props) {
  const [history, setHistory] = useState<EvaluationResult[]>([])
  const [settings, setSettings] = useState<EvaluationSettings | null>(null)
  const [query, setQuery] = useState(currentQuery)
  const [filterQuery, setFilterQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [metricFilter, setMetricFilter] = useState('')
  const [passFilter, setPassFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    try {
      const response = await jobsApi.getEvaluationHistory()
      setHistory(response.results)
      setSettings(response.settings)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load evaluation history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    jobsApi.getEvaluationHistory().then((response) => {
      if (!active) return
      setHistory(response.results)
      setSettings(response.settings)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load evaluation history.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => history.filter((item) => {
    const date = new Date(item.timestamp)
    if (filterQuery && !item.query.toLowerCase().includes(filterQuery.toLowerCase())) return false
    if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false
    if (toDate && date > new Date(`${toDate}T23:59:59.999`)) return false
    if (metricFilter && item.metricName !== metricFilter) return false
    if (passFilter && item.passed !== (passFilter === 'passed')) return false
    return true
  }), [history, filterQuery, fromDate, toDate, metricFilter, passFilter])

  const scored = filtered.filter((item) => item.score !== null)
  const averages = metricNames.map((name) => {
    const values = scored.filter((item) => item.metricName === name)
    const settingThreshold = name === 'Job-Query Alignment'
      ? settings?.alignmentThreshold
      : name === 'Faithfulness'
        ? settings?.faithfulnessThreshold
        : settings?.relevancyThreshold
    return {
      name,
      average: values.length ? values.reduce((sum, item) => sum + (item.score ?? 0), 0) / values.length : null,
      threshold: settingThreshold ?? values[0]?.threshold ?? 0.7,
      count: values.length,
    }
  })
  const chartAverages = averages.filter((item) => !metricFilter || item.name === metricFilter)
  const passRate = filtered.length ? filtered.filter((item) => item.passed).length / filtered.length : 0
  const queryCount = new Set(filtered.map((item) => item.query)).size
  const jobCount = new Set(filtered.flatMap((item) => item.jobId ? [item.jobId] : [])).size
  const alignmentScores = scored.filter((item) => item.metricName === 'Job-Query Alignment')
  const histogram = Array.from({ length: 10 }, (_, index) => ({
    range: `${index / 10}-${(index + 1) / 10}`,
    count: alignmentScores.filter((item) => {
      const score = item.score ?? 0
      return score >= index / 10 && (index === 9 ? score <= 1 : score < (index + 1) / 10)
    }).length,
  }))

  const rows = useMemo(() => {
    const grouped = new Map<string, ResultRow>()
    for (const item of filtered) {
      const key = item.jobId ? `${item.runId}:${item.jobId}` : `${item.runId}:query`
      const row = grouped.get(key) ?? {
        key,
        runId: item.runId,
        query: item.query,
        jobId: item.jobId,
        jobTitle: item.jobTitle ?? 'Retrieved result set',
        company: item.company ?? 'Query-level metric',
        timestamp: item.timestamp,
      }
      if (item.metricName === 'Contextual Relevancy') row.contextual = item
      if (item.metricName === 'Faithfulness') row.faithfulness = item
      if (item.metricName === 'Job-Query Alignment') row.alignment = item
      grouped.set(key, row)
    }
    return [...grouped.values()].sort((left, right) => {
      const leftScore = left.alignment?.score ?? left.contextual?.score ?? left.faithfulness?.score ?? -1
      const rightScore = right.alignment?.score ?? right.contextual?.score ?? right.faithfulness?.score ?? -1
      return sortOrder === 'desc' ? rightScore - leftScore : leftScore - rightScore
    })
  }, [filtered, sortOrder])

  const trend = useMemo(() => {
    const runs = new Map<string, { timestamp: string; totals: Map<string, number[]> }>()
    for (const item of filtered) {
      if (item.score === null) continue
      const run = runs.get(item.runId) ?? { timestamp: item.timestamp, totals: new Map<string, number[]>() }
      const values = run.totals.get(item.metricName) ?? []
      values.push(item.score)
      run.totals.set(item.metricName, values)
      runs.set(item.runId, run)
    }
    return [...runs.entries()].map(([runId, run]) => {
      const average = (name: EvaluationMetricName) => {
        const values = run.totals.get(name) ?? []
        return values.length ? values.reduce((sum, score) => sum + score, 0) / values.length : null
      }
      return {
        run: new Date(run.timestamp).toLocaleDateString(),
        timestamp: run.timestamp,
        runId: runId.slice(0, 8),
        relevancy: average('Contextual Relevancy'),
        faithfulness: average('Faithfulness'),
        alignment: average('Job-Query Alignment'),
      }
    }).sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  }, [filtered])

  const refreshHistory = async () => {
    setLoading(true)
    setError('')
    await refresh()
  }

  const runEvaluation = async () => {
    if (!query.trim()) {
      setError('Enter the search query used for these retrieved jobs.')
      return
    }

    setRunning(true)
    setError('')
    setNotice('')
    try {
      const retrievedJobs = jobs.length
        ? jobs
        : (await jobsApi.search({ query: query.trim(), topK: settings?.maxJobs ?? 10 })).results
      if (!retrievedJobs.length) {
        throw new Error('No jobs were retrieved for this query. Try a broader search or a different query.')
      }
      const result = await jobsApi.runEvaluation({ query: query.trim(), jobIds: retrievedJobs.map(({ job }) => job.jobId) })
      setHistory((previous) => [...result.results, ...previous.filter((item) => item.runId !== result.runId)])
      const evaluatedCount = Math.min(retrievedJobs.length, settings?.maxJobs ?? retrievedJobs.length)
      setNotice(`Evaluation run completed for ${evaluatedCount} retrieved ${evaluatedCount === 1 ? 'job' : 'jobs'}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to run DeepEval.')
    } finally {
      setRunning(false)
    }
  }

  return <section data-testid="deepeval-page" className="deepeval-page">
    <div data-testid="deepeval-heading" className="deepeval-heading">
      <div><div className="eyebrow">RETRIEVAL QUALITY</div><h1>DeepEval Metrics</h1><p>Evaluate query relevance, answer faithfulness, and per-listing alignment using the configured LLM judge.</p></div>
      <button className="button secondary" type="button" onClick={() => void refreshHistory()} disabled={loading || running}><RefreshCw size={15} />Refresh history</button>
    </div>

    <section className="panel deepeval-run-panel">
      <div><div className="eyebrow">CURRENT SEARCH</div><h2>Run evaluation</h2><p>{jobs.length ? `${jobs.length} retrieved ${jobs.length === 1 ? 'job' : 'jobs'} available from the latest search.` : 'Enter a query and run evaluation to retrieve jobs and score them.'}</p></div>
      <label className="deepeval-query-field">Evaluation query and preferences<input data-testid="deepeval-query-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Junior AI Engineer | Location preference: South Africa" maxLength={2000} /></label>
      <button data-testid="deepeval-run-button" className="button primary" type="button" onClick={() => void runEvaluation()} disabled={running || loading || !settings?.enabled}>
        {running ? <><LoaderCircle className="spin" size={16} /> Evaluating…</> : <><Play size={15} /> Run evaluation</>}
      </button>
      {settings && <span className={`deepeval-status ${settings.enabled ? 'enabled' : 'disabled'}`}>{settings.enabled ? 'Evaluation enabled' : 'Evaluation disabled in backend configuration'}</span>}
      {error && <div className="deepeval-message error" role="alert">{error}</div>}
      {notice && <div className="deepeval-message success" role="status">{notice}</div>}
    </section>

    <div className="deepeval-kpis">
      {averages.map((item) => <article data-testid="deepeval-kpi-card" className="panel deepeval-kpi" key={item.name}><span>{item.name} average</span><strong>{item.average !== null ? `${(item.average * 100).toFixed(1)}%` : '—'}</strong><small>Threshold {(item.threshold * 100).toFixed(0)}%</small></article>)}
      <article data-testid="deepeval-kpi-card" className="panel deepeval-kpi"><span>Overall pass rate</span><strong>{filtered.length ? `${(passRate * 100).toFixed(1)}%` : '—'}</strong><small>{filtered.filter((item) => item.passed).length} passing of {filtered.length} results</small></article>
      <article data-testid="deepeval-kpi-card" className="panel deepeval-kpi"><span>Queries / jobs evaluated</span><strong>{queryCount} / {jobCount}</strong><small>Across filtered history</small></article>
      <article data-testid="deepeval-kpi-card" className="panel deepeval-kpi"><span>Judge model</span><strong className="model-name">{settings?.judgeModel ?? 'Loading…'}</strong><small>Groq judge</small></article>
    </div>

    <section className="panel deepeval-filters">
      <div className="panel-heading"><div><div className="eyebrow">HISTORY</div><h2>Filter evaluation results</h2></div><span className="deepeval-count">{filtered.length} metric results</span></div>
      <div className="deepeval-filter-grid">
        <label>Query<select value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)}><option value="">All queries</option>{[...new Set(history.map((item) => item.query))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <label>Metric<select data-testid="deepeval-metric-filter" value={metricFilter} onChange={(event) => setMetricFilter(event.target.value)}><option value="">All metrics</option>{metricNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>Result<select data-testid="deepeval-pass-filter" value={passFilter} onChange={(event) => setPassFilter(event.target.value)}><option value="">Pass and fail</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
      </div>
    </section>

    {loading ? <div className="empty-card"><LoaderCircle className="spin" size={19} /> Loading DeepEval history…</div> : <>
      <div className="deepeval-chart-grid">
        <section className="panel deepeval-chart-panel"><div className="panel-heading"><div><div className="eyebrow">SCORE VS THRESHOLD</div><h2>Average metric score</h2></div></div>
          <div className="deepeval-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartAverages} margin={{ top: 14, right: 14, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} /><Tooltip formatter={(value) => value === null ? 'No scores' : `${(Number(value) * 100).toFixed(1)}%`} /><Bar dataKey="average" name="Average score" fill="#7057db" radius={[5, 5, 0, 0]} /><Bar dataKey="threshold" name="Threshold" fill="#d56a72" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="panel deepeval-chart-panel"><div className="panel-heading"><div><div className="eyebrow">JOB-QUERY ALIGNMENT</div><h2>Score distribution</h2></div></div>
          <div className="deepeval-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={histogram} margin={{ top: 14, right: 14, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="range" label={{ value: 'Alignment score range', position: 'insideBottom', offset: -2, fontSize: 10 }} tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} label={{ value: 'Jobs', angle: -90, position: 'insideLeft', fontSize: 10 }} /><Tooltip /><Bar dataKey="count" name="Jobs" fill="#48a987" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
      </div>

      <section className="panel deepeval-chart-panel"><div className="panel-heading"><div><div className="eyebrow">RUN HISTORY</div><h2>Average scores over time</h2></div></div>
        <div className="deepeval-chart deepeval-trend-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 14, right: 18, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="run" tick={{ fontSize: 10 }} /><YAxis domain={[0, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} /><Tooltip labelFormatter={(_, data) => `Run ${data?.[0]?.payload?.runId ?? ''}`} formatter={(value) => value === null ? 'No score' : `${(Number(value) * 100).toFixed(1)}%`} /><Line type="monotone" dataKey="relevancy" name="Contextual Relevancy" stroke="#7057db" strokeWidth={2} connectNulls /><Line type="monotone" dataKey="faithfulness" name="Faithfulness" stroke="#d28a26" strokeWidth={2} connectNulls /><Line type="monotone" dataKey="alignment" name="Job-Query Alignment" stroke="#168a67" strokeWidth={2} connectNulls /></LineChart></ResponsiveContainer></div>
      </section>

      <section className="panel deepeval-table-panel"><div className="panel-heading"><div><div className="eyebrow">DETAILED RESULTS</div><h2>Per-job evaluation results</h2></div><button className="deepeval-sort" type="button" onClick={() => setSortOrder((value) => value === 'desc' ? 'asc' : 'desc')}>Sort by score {sortOrder === 'desc' ? '↓' : '↑'}</button></div>
        {rows.length ? <div className="deepeval-table-scroll"><table data-testid="deepeval-results-table" className="deepeval-table"><thead><tr><th>Job / query</th><th>Company</th><th>Query relevance</th><th>Faithfulness</th><th>Job alignment</th><th>Status</th><th>Run details</th></tr></thead><tbody>{rows.map((row) => {
          const failed = [row.contextual, row.faithfulness, row.alignment].some((value) => value && !value.passed)
          const passed = [row.contextual, row.faithfulness, row.alignment].filter(Boolean).every((value) => value?.passed)
          return <tr className={failed ? 'failed-row' : ''} key={row.key}>
            <td><strong>{row.jobTitle}</strong><small>{row.query}</small></td><td>{row.company}</td>
            <td>{metricCell(row.contextual)}</td><td>{metricCell(row.faithfulness)}</td><td>{metricCell(row.alignment)}</td>
            <td><span className={`deepeval-badge ${passed && !failed ? 'pass' : 'fail'}`}>{passed && !failed ? 'PASS' : 'FAIL'}</span></td>
            <td><details><summary>Reasons</summary><div className="deepeval-reasons">{row.contextual && <p><strong>Query relevance:</strong> {row.contextual.reason || row.contextual.error || 'No reason returned.'}</p>}{row.faithfulness && <><p><strong>Faithfulness:</strong> {row.faithfulness.reason || row.faithfulness.error || 'No reason returned.'}</p>{row.faithfulness.generatedAnswer && <p><strong>Generated answer:</strong> {row.faithfulness.generatedAnswer}</p>}</>}{row.alignment && <p><strong>Job alignment:</strong> {row.alignment.reason || row.alignment.error || 'No reason returned.'}</p>}<small>{new Date(row.timestamp).toLocaleString()} · Run {row.runId.slice(0, 8)}</small></div></details></td>
          </tr>
        })}</tbody></table></div> : <div data-testid="deepeval-empty-state" className="deepeval-empty">{history.length ? 'No results match these filters.' : 'No evaluations yet. Search for jobs and run an evaluation to start building history.'}</div>}
      </section>
    </>}
  </section>
}

function metricCell(result?: EvaluationResult) {
  if (!result) return <span className="deepeval-no-score">—</span>
  return <span className={result.passed ? 'deepeval-score pass-score' : 'deepeval-score fail-score'}>{result.score === null ? 'Error' : `${(result.score * 100).toFixed(1)}%`}</span>
}
