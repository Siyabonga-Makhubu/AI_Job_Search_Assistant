import { lazy, Suspense, useEffect, useState } from 'react'
import { Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CircleHelp, Clipboard, Clock3, FileSearch, FileText, FileUp, LoaderCircle, MapPin, Menu, Plus, Search, Send, Sparkles, Trash2, X, BookmarkCheck, Volume2 } from 'lucide-react'
import { InterviewPage } from './InterviewPage'
import { jobsApi } from './services/jobsApi'
import { interviewsApi } from './services/interviewsApi'
import type { InterviewMode, InterviewDifficulty } from './types/interview'
import { APPLICATION_STATUSES, type ApplicationDraft, type ApplicationMessageOptions, type ApplicationMessageType, type ApplicationStatus, type CandidateEvidence, type InterviewPreparation, type Job, type JobConfig, type JobDashboardOverview, type JobSearchResult, type MatchAnalysis, type RequirementMatch, type TailoredCv, type TailoredCvEdits } from './types/jobs'
import './App.css'
import './Brand.css'
import './Dashboard.css'
import './SavedJobs.css'
import './ApplicationMessage.css'

const DeepEvalMetrics = lazy(() => import('./DeepEvalMetrics').then((module) => ({ default: module.DeepEvalMetrics })))

type Route = { page: 'dashboard' | 'jobs' | 'detail' | 'analysis' | 'ingest' | 'saved' | 'interview' | 'evaluation'; jobId?: string; sessionId?: string }
const messageTypes: ApplicationMessageType[] = ['Recruiter message', 'Cover letter', 'Email', 'LinkedIn message']
const DEFAULT_SEARCH_ROLES = ['Junior AI Engineer', 'AI Engineer', 'Generative AI Engineer', 'LLM Engineer', 'RAG Engineer']
function routeFromPath(path: string): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'interviews' && parts[1]) return { page: 'interview', sessionId: decodeURIComponent(parts[1]) }
  if (parts[0] === 'jobs' && parts[1] === 'ingest') return { page: 'ingest' }
  if (parts[0] === 'jobs' && parts[1]) return { page: parts[2] === 'analysis' ? 'analysis' : 'detail', jobId: decodeURIComponent(parts[1]) }
  if (parts[0] === 'jobs') return { page: 'jobs' }
  if (parts[0] === 'saved') return { page: 'saved' }
  if (parts[0] === 'evaluation') return { page: 'evaluation' }
  return { page: 'dashboard' }
}

function App() {
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname))
  const [config, setConfig] = useState<JobConfig | null>(null)
  const [configError, setConfigError] = useState('')
  const [overview, setOverview] = useState<JobDashboardOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState('')
  const [results, setResults] = useState<JobSearchResult[] | null>(null)
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [searchText, setSearchText] = useState('')
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState('any')
  const [source, setSource] = useState('all')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [saved, setSaved] = useState<Job[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [savedError, setSavedError] = useState('')
  const saveJob = async (job: Job) => {
    setSavedError('')
    try {
      const savedJob = await jobsApi.saveJob(job.jobId)
      setSaved(current => current.some(item => item.jobId === savedJob.jobId) ? current.map(item => item.jobId === savedJob.jobId ? savedJob : item) : [savedJob, ...current])
    } catch (error) { setSavedError(error instanceof Error ? error.message : 'Unable to save this job.') }
  }
  const updateSavedJob = (updated: Job) => setSaved(current => current.map(item => item.jobId === updated.jobId ? updated : item))

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    jobsApi.getConfig().then((value) => {
      setConfig(value)
      setLocation(value.searchLocation)
    }).catch((error: unknown) => setConfigError(error instanceof Error ? error.message : 'Unable to load job search configuration.'))
    jobsApi.getSavedJobs().then(setSaved).catch((error: unknown) => setSavedError(error instanceof Error ? error.message : 'Unable to load saved jobs.')).finally(() => setSavedLoading(false))
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (route.page !== 'dashboard') return
    let active = true
    setOverviewLoading(true)
    setOverviewError('')
    jobsApi.getOverview()
      .then((value) => { if (active) setOverview(value) })
      .catch((error: unknown) => { if (active) setOverviewError(error instanceof Error ? error.message : 'Unable to load dashboard activity.') })
      .finally(() => { if (active) setOverviewLoading(false) })
    return () => { active = false }
  }, [route.page])

  const navigate = (path: string) => {
    window.history.pushState({}, '', path)
    setRoute(routeFromPath(path))
    setMobileNav(false)
    window.scrollTo(0, 0)
  }

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault()
    // A selected role is an explicit filter and should take precedence over
    // the free-text field so the dropdown always affects the search.
    const query = role.trim() || searchText.trim()
    if (!query) { setSearchError('Enter a job title or search phrase.'); return }
    setSearching(true); setSearchError('')
    try {
      const response = await jobsApi.search({ query, ...(location.trim() ? { location: location.trim() } : {}), ...(remote !== 'any' ? { remote: remote === 'yes' } : {}), source })
      setResults(response.results)
      const preferences = [
        location.trim() ? `Location preference: ${location.trim()}` : '',
        remote === 'yes' ? 'Workplace preference: remote' : remote === 'no' ? 'Workplace preference: on-site or hybrid' : '',
      ].filter(Boolean)
      setLastSearchQuery([query, ...preferences].join(' | '))
      navigate('/jobs')
    } catch (error) { setSearchError(error instanceof Error ? error.message : 'Unable to search jobs.') }
    finally { setSearching(false) }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><img className="brand-logo" src="/brand-logo.png" alt="Siya’s AI Job Assistance" /><button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button data-testid="nav-overview" className={`nav-link ${route.page === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('/')}><span className="nav-icon"><BriefcaseBusiness size={17} /></span>Overview</button>
        <button data-testid="nav-jobs" className={`nav-link ${route.page === 'jobs' || route.page === 'detail' || route.page === 'analysis' ? 'active' : ''}`} onClick={() => navigate('/jobs')}><span className="nav-icon"><Search size={17} /></span>Job discovery</button>
        <button data-testid="nav-ingest" className={`nav-link ${route.page === 'ingest' ? 'active' : ''}`} onClick={() => navigate('/jobs/ingest')}><span className="nav-icon"><ArrowDownLeft size={17} /></span>Add a job</button>
        <button data-testid="nav-saved" className={`nav-link ${route.page === 'saved' ? 'active' : ''}`} onClick={() => navigate('/saved')}><span className="nav-icon"><BookmarkCheck size={17} /></span>Saved jobs <span className="nav-count">{saved.length}</span></button>
        <button data-testid="nav-evaluation" className={`nav-link ${route.page === 'evaluation' ? 'active' : ''}`} onClick={() => navigate('/evaluation')}><span className="nav-icon"><Sparkles size={17} /></span>DeepEval Metrics</button>
      </nav>
      <div className="sidebar-bottom"><span className="service-dot" /> Connected to Resume RAG API <small>Evidence grounded in your resume</small></div>
    </aside>
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={19} /></button><div className="breadcrumbs">Workspace <ChevronRight size={14} /> <strong>{route.page === 'detail' ? 'Job details' : route.page === 'analysis' ? 'Match analysis' : route.page === 'jobs' ? 'Job discovery' : route.page === 'ingest' ? 'Add a job' : route.page === 'interview' ? 'AI interview' : route.page === 'evaluation' ? 'DeepEval Metrics' : 'Overview'}</strong></div><div className="api-indicator"><span /> REST API</div></header>
      <div className="page-content">
        {route.page === 'dashboard' && <Dashboard go={navigate} config={config} configError={configError} overview={overview} overviewLoading={overviewLoading} overviewError={overviewError} />}
        {route.page === 'jobs' && <JobsPage results={results} searchText={searchText} setSearchText={setSearchText} role={role} setRole={setRole} location={location} setLocation={setLocation} remote={remote} setRemote={setRemote} source={source} setSource={setSource} roles={config?.searchRoles?.length ? config.searchRoles : DEFAULT_SEARCH_ROLES} sources={config?.searchSources ?? []} loading={searching} error={searchError} saveError={savedError} onSearch={search} go={navigate} onSave={saveJob} savedIds={saved.map(item => item.jobId)} />}
        {route.page === 'saved' && <SavedJobsPage items={saved} loading={savedLoading} error={savedError} onJobUpdate={updateSavedJob} go={navigate} />}
        {route.page === 'evaluation' && <Suspense fallback={<Loading label="Loading DeepEval metrics…" />}><DeepEvalMetrics query={lastSearchQuery} jobs={results ?? []} /></Suspense>}
        {route.page === 'detail' && route.jobId && <JobDetail key={route.jobId} jobId={route.jobId} go={navigate} />}
        {route.page === 'analysis' && route.jobId && <AnalysisPage key={route.jobId} jobId={route.jobId} go={navigate} />}
        {route.page === 'interview' && route.sessionId && <InterviewPage key={route.sessionId} sessionId={route.sessionId} go={navigate} />}
        {route.page === 'ingest' && <IngestPage go={navigate} />}
      </div>
    </main>
  </div>
}

function Dashboard({ go, config, configError, overview, overviewLoading, overviewError }: { go: (path: string) => void; config: JobConfig | null; configError: string; overview: JobDashboardOverview | null; overviewLoading: boolean; overviewError: string }) {
  return <>
    <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={18} /></div><div><strong>Your job search, grounded in real resume evidence</strong><p>Discover roles, review requirements against your Resume RAG profile, and prepare application drafts for your review.</p></div><span className="welcome-tag">AI ENGINEERING</span></div>
    <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1 data-testid="dashboard-heading">Good day. Ready to find your next role?</h1><p>Search current job records or add a public job listing to get started.</p></div></div>
    <section className="quick-grid">
      <button className="quick-card" onClick={() => go('/jobs')}><span className="quick-icon violet"><Search size={20} /></span><span className="quick-title">Explore jobs <ArrowUpRight size={16} /></span><span className="quick-description">Search stored AI engineering roles and compare them with resume evidence.</span><span className="quick-cta">Open job discovery <ChevronRight size={15} /></span></button>
      <button className="quick-card" onClick={() => go('/jobs/ingest')}><span className="quick-icon blue"><FileSearch size={20} /></span><span className="quick-title">Add a job <ArrowUpRight size={16} /></span><span className="quick-description">Ingest a public job URL into the backend for details and matching.</span><span className="quick-cta">Add a listing <ChevronRight size={15} /></span></button>
    </section>
    <section className="dashboard-overview" aria-labelledby="dashboard-stats-title">
      <div className="dashboard-section-heading"><div><div className="eyebrow">APPLICATION PIPELINE</div><h2 id="dashboard-stats-title">Your job search at a glance</h2></div><span className="live-pill"><span /> LIVE DATA</span></div>
      {overviewError ? <ErrorNotice text={overviewError} /> : overviewLoading || !overview ? <Loading label="Loading job statistics…" /> : <div className="dashboard-stat-grid" data-testid="dashboard-stats">
        <DashboardStat icon={<BriefcaseBusiness size={17} />} label="Jobs discovered" value={overview.stats.totalJobs} metric="totalJobs" />
        <DashboardStat icon={<BookmarkCheck size={17} />} label="Saved jobs" value={overview.stats.savedJobs} metric="savedJobs" />
        <DashboardStat icon={<Send size={17} />} label="Applications" value={overview.stats.applications} metric="applications" />
        <DashboardStat icon={<CalendarDays size={17} />} label="Interviews" value={overview.stats.interviews} metric="interviews" />
        <DashboardStat icon={<Check size={17} />} label="Offers" value={overview.stats.offers} metric="offers" />
      </div>}
    </section>
    <section className="panel activity-panel" aria-labelledby="recent-activity-title" data-testid="dashboard-activity">
      <div className="panel-heading"><div><div className="eyebrow">WORKSPACE HISTORY</div><h2 id="recent-activity-title">Recent activity</h2></div><Activity size={17} className="activity-heading-icon" /></div>
      {overviewError ? <ErrorNotice text={overviewError} /> : overviewLoading || !overview ? <Loading label="Loading recent activity…" /> : overview.activity.length ? <ol className="activity-list">
        {overview.activity.map((item, index) => <li className="activity-item" key={`${item.jobId}-${item.type}-${item.occurredAt}-${index}`}>
          <span className="activity-item-icon"><Clock3 size={14} /></span>
          <div className="activity-item-copy"><strong>{activityLabel(item.type)}</strong><button type="button" onClick={() => go(`/jobs/${encodeURIComponent(item.jobId)}`)}>{item.title}{item.company ? ` · ${item.company}` : ''}</button></div>
          <time dateTime={item.occurredAt}>{formatActivityTime(item.occurredAt)}</time>
        </li>)}
      </ol> : <p className="activity-empty">Your job and application activity will appear here as you discover, save, and track roles.</p>}
    </section>
    <section className="panel overview-panel"><div className="panel-heading"><div><div className="eyebrow">SYSTEM CONNECTION</div><h2>Job search defaults</h2></div><span className="live-pill"><span /> BACKEND CONFIG</span></div>{configError ? <ErrorNotice text={configError} /> : config ? <div data-testid="dashboard-config-panel" className="config-grid"><div><small>Configured search roles</small><div className="chips">{config.searchRoles.map((item) => <span className="chip" key={item}>{item}</span>)}</div></div><div><small>Default location</small><strong>{config.searchLocation}</strong></div><div><small>Remote filter</small><strong>{config.searchRemote ? 'Remote only' : 'Any workplace'}</strong></div></div> : <Loading label="Loading backend configuration…" />}</section>
  </>
}

function DashboardStat({ icon, label, value, metric }: { icon: React.ReactNode; label: string; value: number; metric: string }) {
  return <div className="dashboard-stat" data-testid={`dashboard-stat-${metric}`}><span className="dashboard-stat-icon">{icon}</span><div><strong>{value.toLocaleString()}</strong><span>{label}</span></div></div>
}

function activityLabel(type: JobDashboardOverview['activity'][number]['type']): string {
  const labels: Record<JobDashboardOverview['activity'][number]['type'], string> = {
    job_discovered: 'Job discovered',
    job_saved: 'Job saved',
    application_submitted: 'Application submitted',
    interview_scheduled: 'Interview scheduled',
    resume_match: 'Resume match completed',
    tailored_cv_saved: 'Tailored CV saved',
    interview_prepared: 'Interview preparation completed',
  }
  return labels[type]
}

function formatActivityTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  const differenceInDays = Math.round((date.getTime() - Date.now()) / 86_400_000)
  if (Math.abs(differenceInDays) < 30) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(differenceInDays, 'day')
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function JobsPage(props: { results: JobSearchResult[] | null; searchText: string; setSearchText: (v: string) => void; role: string; setRole: (v: string) => void; location: string; setLocation: (v: string) => void; remote: string; setRemote: (v: string) => void; source: string; setSource: (v: string) => void; roles: string[]; sources: { name: string; label: string }[]; loading: boolean; error: string; saveError: string; onSearch: (event?: React.FormEvent) => void; go: (path: string) => void; onSave: (job: Job) => void; savedIds: string[] }) {
  return <><div className="page-heading"><div><div className="eyebrow">DISCOVER OPPORTUNITIES</div><h1>Find your next AI engineering role</h1><p>Search job records from the backend and explore how each role aligns with documented candidate evidence.</p></div></div>
    {props.saveError && <ErrorNotice text={props.saveError} />}
    <form className="panel search-panel" onSubmit={props.onSearch}><label className="field-label" htmlFor="job-query">Search jobs</label><div className="search-line"><div className="search-input-wrap"><Search size={18} /><input data-testid="job-search-input" id="job-query" value={props.searchText} onChange={(e) => props.setSearchText(e.target.value)} placeholder="e.g. Junior AI Engineer, RAG, Python, LLM" /></div><button data-testid="job-search-button" className="button primary" disabled={props.loading}>{props.loading ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}{props.loading ? 'Searching…' : 'Search jobs'}</button></div><div className="filter-row"><div className="field"><label htmlFor="role">Role</label><select data-testid="job-role-select" id="role" value={props.role} onChange={(e) => props.setRole(e.target.value)}><option value="">Any role</option>{props.roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="location">Location</label><input data-testid="job-location-input" id="location" value={props.location} onChange={(e) => props.setLocation(e.target.value)} placeholder="Any location" /></div><div className="field"><label htmlFor="remote">Remote</label><select data-testid="job-remote-select" id="remote" value={props.remote} onChange={(e) => props.setRemote(e.target.value)}><option value="any">Any</option><option value="yes">Remote</option><option value="no">On-site / hybrid</option></select></div><div className="field"><label htmlFor="source">Source</label><select data-testid="job-source-select" id="source" value={props.source} onChange={(e) => props.setSource(e.target.value)}><option value="all">All supported sources</option>{props.sources.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}</select></div></div>{props.error && <ErrorNotice text={props.error} />}</form>
    <div className="results-heading"><div><div className="eyebrow">SEARCH RESULTS</div><h2>{props.results ? `${props.results.length} ${props.results.length === 1 ? 'role' : 'roles'} found` : 'Your results will appear here'}</h2></div>{props.results && <span className="result-source">{props.results.length} returned by backend</span>}</div>
    {props.results === null ? <div data-testid="job-empty-state" className="empty-card"><div className="empty-icon"><Search size={22} /></div><strong>Start with a job search</strong><p>Try a role title, technology, or a combination such as “Junior AI Engineer RAG Python”.</p></div> : props.results.length === 0 ? <div data-testid="job-empty-state" className="empty-card"><div className="empty-icon"><Search size={22} /></div><strong>No jobs found</strong><p>Try another job title, broader search terms, or a different location.</p></div> : <div data-testid="job-results-grid" className="job-grid">{props.results.map(({ job }, index) => <JobCard key={job.jobId} job={job} index={index} go={props.go} onSave={props.onSave} isSaved={props.savedIds.includes(job.jobId)} />)}</div>}
  </>
}

function JobCard({ job, index, go, onSave, isSaved }: { job: Job; index: number; go: (path: string) => void; onSave: (job: Job) => void; isSaved: boolean }) {
  const sourceLabels: Record<string, string> = { adzuna: 'Adzuna South Africa', jsearch: 'JSearch · multiple job sites', linkedin: 'LinkedIn Jobs', indeed: 'Indeed South Africa', careers24: 'Careers24', pnet: 'PNet', careerjunction: 'CareerJunction', jobmail: 'Job Mail', jobvine: 'JobVine', glassdoor: 'Glassdoor' }
  const sourceLabel = job.source?.site || sourceLabels[job.source?.provider] || job.source?.provider
  const openJob = () => job.external ? window.open(job.source.url, '_blank', 'noopener,noreferrer') : go(`/jobs/${encodeURIComponent(job.jobId)}`)
  return <JobResultCard job={job} index={index} sourceLabel={sourceLabel} openJob={openJob} go={go} onSave={onSave} isSaved={isSaved} />
}

function JobResultCard({ job, index, sourceLabel, openJob, go, onSave, isSaved }: { job: Job; index: number; sourceLabel?: string; openJob: () => void; go: (path: string) => void; onSave: (job: Job) => void; isSaved: boolean }) {
  const [match, setMatch] = useState<MatchAnalysis | null>(null)
  const [matchError, setMatchError] = useState('')
  useEffect(() => {
    let active = true
    jobsApi.match(job.jobId).then((response) => { if (active) setMatch(response.match) }).catch((error: unknown) => { if (active) setMatchError(error instanceof Error ? error.message : 'Resume comparison unavailable.') })
    return () => { active = false }
  }, [job.jobId])
  const supported = match ? match.matchedRequirements.length + match.partialRequirements.length : 0
  const compared = match ? supported + match.notEvidencedRequirements.length : 0
  return <article data-testid="job-card" className="job-card"><div className="job-card-top"><div className={`company-avatar avatar-${index % 5}`}>{(job.company || job.title).slice(0, 1).toUpperCase()}</div><div className="job-card-meta"><span className="source-label">{sourceLabel}</span><span>{job.publishedAt ? `Date posted/updated ${formatDate(job.publishedAt)}` : 'Date posted not listed'}</span></div><button className="icon-button" aria-label={`View ${job.title}`} onClick={openJob}><ArrowUpRight size={17} /></button></div><h3>{job.title}</h3><div className="job-company">{job.company ?? 'Company not listed'}</div><div className="job-location"><span><MapPin size={14} />{job.location ?? 'Location not listed'}</span>{job.remote !== undefined && <span className="remote-chip">{job.remote ? 'Remote' : 'On-site / hybrid'}</span>}</div>{job.description && <p className="job-summary">{job.description}</p>}<div className="job-match-summary" aria-live="polite"><Sparkles size={14} />{match ? <span>Latest CV: {supported} of {compared} requirements supported</span> : matchError ? <span>{matchError}</span> : <span>Comparing with latest ingested CV…</span>}</div><div className="job-card-actions"><button className="button secondary" onClick={() => onSave(job)} disabled={isSaved}><BookmarkCheck size={14} />{isSaved ? 'Saved' : 'Save job'}</button><a className="button secondary" href={job.source.url} target="_blank" rel="noreferrer">View original listing <ArrowUpRight size={15} /></a>{!job.external && <><TailoredCvAction job={job} /><button className="text-button" onClick={() => go(`/jobs/${encodeURIComponent(job.jobId)}/analysis`)}><Sparkles size={15} /> Analyse match</button></>}</div></article>
}

function TailoredCvAction({ job }: { job: Job }) {
  const [cv, setCv] = useState<TailoredCv | null>(job.tailoredCv ?? null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openEditor = async () => {
    setLoading(true)
    setError('')
    try {
      const savedCv = cv ?? await jobsApi.generateTailoredCv(job.jobId)
      setCv(savedCv)
      setOpen(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate a tailored CV.') }
    finally { setLoading(false) }
  }

  const saveCv = async (edits: TailoredCvEdits) => {
    const savedCv = await jobsApi.saveTailoredCv(job.jobId, edits)
    setCv(savedCv)
    return savedCv
  }

  return <>
    <button className="button secondary" onClick={() => void openEditor()} disabled={loading}>
      {loading ? <LoaderCircle className="spin" size={14} /> : <FileText size={14} />}
      {loading ? 'Generating CV…' : cv?.savedAt ? 'Edit tailored CV' : 'Generate CV'}
    </button>
    {error && <span className="cv-card-error" role="alert">{error}</span>}
    {open && cv && <TailoredCvEditor cv={cv} onClose={() => setOpen(false)} onSave={saveCv} />}
  </>
}

function TailoredCvEditor({ cv, onClose, onSave }: { cv: TailoredCv; onClose: () => void; onSave: (edits: TailoredCvEdits) => Promise<TailoredCv> }) {
  const [personalDetails, setPersonalDetails] = useState(() => ({
    email: cv.personalDetails?.email ?? '',
    phone: cv.personalDetails?.phone ?? '',
    location: cv.personalDetails?.location ?? '',
    linkedin: cv.personalDetails?.linkedin ?? '',
    github: cv.personalDetails?.github ?? '',
    portfolio: cv.personalDetails?.portfolio ?? '',
  }))
  const [education, setEducation] = useState(cv.education ?? '')
  const [projects, setProjects] = useState<TailoredCvEdits['projects']>(() => cv.projects ?? [])
  const [experience, setExperience] = useState<TailoredCvEdits['experience']>(() => cv.experience?.length ? cv.experience : cv.relevantExperience?.length ? [{ title: 'Existing resume evidence', details: cv.relevantExperience }] : [])
  const [certificationsAndAchievements, setCertificationsAndAchievements] = useState(cv.certificationsAndAchievements ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const updatePersonal = (field: keyof TailoredCvEdits['personalDetails'], value: string) => setPersonalDetails(current => ({ ...current, [field]: value }))
  const updateEntry = (section: 'projects' | 'experience', index: number, update: Partial<TailoredCvEdits['projects'][number]>) => {
    const updateCurrent = (current: TailoredCvEdits['projects']) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...update } : entry)
    if (section === 'projects') setProjects(updateCurrent)
    else setExperience(updateCurrent)
  }
  const addEntry = (section: 'projects' | 'experience') => {
    const addCurrent = (current: TailoredCvEdits['projects']) => [...current, { title: '', details: [] }]
    if (section === 'projects') setProjects(addCurrent)
    else setExperience(addCurrent)
  }
  const removeEntry = (section: 'projects' | 'experience', index: number) => {
    const removeCurrent = (current: TailoredCvEdits['projects']) => current.filter((_, entryIndex) => entryIndex !== index)
    if (section === 'projects') setProjects(removeCurrent)
    else setExperience(removeCurrent)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try { await onSave({ personalDetails, education, projects, experience, certificationsAndAchievements }); setSaved(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save this CV.') }
    finally { setSaving(false) }
  }

  return <div className="tailored-cv-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="tailored-cv-modal" role="dialog" aria-modal="true" aria-labelledby="tailored-cv-title">
      <header className="tailored-cv-header"><div><div className="eyebrow">JOB-SPECIFIC CV</div><h2 id="tailored-cv-title">{cv.jobTitle}{cv.company ? ` · ${cv.company}` : ''}</h2><p>Generated from your stored resume evidence and this job’s requirements.</p></div><button className="icon-button" type="button" aria-label="Close CV editor" onClick={onClose}><X size={17}/></button></header>
      <form onSubmit={submit}>
        <div className="tailored-cv-content">
          <section className="cv-identity"><h2>{cv.personalDetails?.name || 'Name not listed on source resume'}</h2><strong>{cv.headline || cv.jobTitle}</strong><p>{[personalDetails.location, personalDetails.email, personalDetails.phone, personalDetails.linkedin, personalDetails.github, personalDetails.portfolio].filter(Boolean).join(' | ')}</p></section>
          <section className="cv-edit-section"><h3>Personal details</h3><div className="cv-personal-grid">
            <label>Email<input type="email" value={personalDetails.email} onChange={event => updatePersonal('email', event.target.value)} maxLength={300}/></label>
            <label>Phone<input value={personalDetails.phone} onChange={event => updatePersonal('phone', event.target.value)} maxLength={300}/></label>
            <label>Location<input value={personalDetails.location} onChange={event => updatePersonal('location', event.target.value)} maxLength={300}/></label>
            <label>LinkedIn<input value={personalDetails.linkedin} onChange={event => updatePersonal('linkedin', event.target.value)} maxLength={300}/></label>
            <label>GitHub<input value={personalDetails.github} onChange={event => updatePersonal('github', event.target.value)} maxLength={300}/></label>
            <label>Portfolio<input value={personalDetails.portfolio} onChange={event => updatePersonal('portfolio', event.target.value)} maxLength={300}/></label>
          </div></section>
          <section className="cv-read-section"><h3>Professional Summary</h3><p>{cv.professionalSummary || 'No summary was present in the stored resume.'}</p></section>
          <section className="cv-read-section"><h3>Technical Skills</h3>{(cv.technicalSkills?.length ? cv.technicalSkills : [{ category: 'Other documented skills', skills: cv.skills ?? [] }]).map(group => <div className="cv-skill-group" key={group.category}><h4>{group.category}</h4>{group.skills.length ? <p>{group.skills.join(', ')}</p> : <p className="muted">No documented skills listed.</p>}</div>)}</section>
          <section className="cv-edit-section"><div className="cv-edit-heading"><h3>Selected AI and Software Projects</h3><button className="text-button" type="button" onClick={() => addEntry('projects')}><Plus size={14}/>Add project</button></div>{projects.length ? projects.map((project, index) => <div className="cv-edit-entry" key={`project-${index}`}><div className="cv-entry-title-row"><label>Project title<input value={project.title} onChange={event => updateEntry('projects', index, { title: event.target.value })} maxLength={300}/></label><button className="icon-button" type="button" aria-label={`Remove project ${index + 1}`} onClick={() => removeEntry('projects', index)}><Trash2 size={15}/></button></div><label>Project details<textarea value={project.details.join('\n')} onChange={event => updateEntry('projects', index, { details: event.target.value.split(/\r?\n/) })} maxLength={15000} rows={3}/></label></div>) : <p className="muted">No project details. Add a project to include one.</p>}</section>
          <section className="cv-edit-section"><div className="cv-edit-heading"><h3>Experience</h3><button className="text-button" type="button" onClick={() => addEntry('experience')}><Plus size={14}/>Add experience</button></div>{experience.length ? experience.map((entry, index) => <div className="cv-edit-entry" key={`experience-${index}`}><div className="cv-entry-title-row"><label>Role, employer, dates<input value={entry.title} onChange={event => updateEntry('experience', index, { title: event.target.value })} maxLength={300}/></label><button className="icon-button" type="button" aria-label={`Remove experience ${index + 1}`} onClick={() => removeEntry('experience', index)}><Trash2 size={15}/></button></div><label>Experience details<textarea value={entry.details.join('\n')} onChange={event => updateEntry('experience', index, { details: event.target.value.split(/\r?\n/) })} maxLength={15000} rows={3}/></label></div>) : <p className="muted">No experience details. Add an experience entry to include one.</p>}</section>
          <section className="cv-edit-section"><h3>Education</h3><textarea aria-label="Education section" value={education} onChange={event => setEducation(event.target.value)} maxLength={10000} rows={5}/></section>
          <section className="cv-edit-section"><h3>Certifications and Achievements</h3><textarea aria-label="Certifications and achievements" value={certificationsAndAchievements.join('\n')} onChange={event => setCertificationsAndAchievements(event.target.value.split(/\r?\n/))} maxLength={10000} rows={4}/></section>
        </div>
        <footer className="tailored-cv-footer">{error ? <span className="cv-save-error" role="alert">{error}</span> : saved ? <span className="cv-save-success">CV saved to your database.</span> : <span className="muted">Name, summary, and skills remain read-only.</span>}<button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/ >}{saving ? 'Saving CV…' : 'Save CV'}</button></footer>
      </form>
    </section>
  </div>
}

function SavedJobsPage({ items, loading, error, onJobUpdate, go }: { items: Job[]; loading: boolean; error: string; onJobUpdate: (job: Job) => void; go: (path: string) => void }) {
  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE</div><h1>Saved jobs</h1><p>Track each opportunity from discovery through interview and closure.</p></div></div>
    {error && <ErrorNotice text={error} />}
    {loading ? <Loading label="Loading saved jobs…" /> : items.length ? <div className="saved-list">{items.map(job => <SavedJobCard key={job.jobId} job={job} onJobUpdate={onJobUpdate} go={go} />)}</div> : !error && <div className="empty-card"><div className="empty-icon"><BookmarkCheck size={22}/></div><strong>No saved jobs yet</strong><p>Save a job from search results to track its application status.</p><button className="button primary" onClick={() => go('/jobs')}>Discover jobs</button></div>}
  </>
}

function SavedJobCard({ job, onJobUpdate, go }: { job: Job; onJobUpdate: (job: Job) => void; go: (path: string) => void }) {
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>(job.status ?? 'SAVED')
  const [appliedDate, setAppliedDate] = useState(job.appliedAt?.slice(0, 10) ?? '')
  const [interviewDate, setInterviewDate] = useState(job.interviewDate?.slice(0, 10) ?? '')
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setSelectedStatus(job.status ?? 'SAVED')
    setAppliedDate(job.appliedAt?.slice(0, 10) ?? '')
    setInterviewDate(job.interviewDate?.slice(0, 10) ?? '')
  }, [job.status, job.appliedAt, job.interviewDate])

  const run = async (action: string, operation: () => Promise<Job>) => {
    setPending(action)
    setError('')
    try { onJobUpdate(await operation()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update this application.') }
    finally { setPending('') }
  }
  const asIsoDate = (date: string) => date ? `${date}T00:00:00.000Z` : null
  const updateStatus = () => run('status', () => jobsApi.updateStatus(job.jobId, selectedStatus))
  const markApplied = () => run('applied', () => jobsApi.updateApplication(job.jobId, { status: 'APPLIED', appliedAt: new Date().toISOString() }))
  const saveAppliedDate = () => run('applied-date', () => jobsApi.updateApplication(job.jobId, { appliedAt: asIsoDate(appliedDate) }))
  const saveInterviewDate = () => run('interview-date', () => jobsApi.updateApplication(job.jobId, { interviewDate: asIsoDate(interviewDate) }))
  const analyseMatch = () => run('analysis', async () => {
    const result = await jobsApi.match(job.jobId)
    return { ...job, matchAnalysis: result.match }
  })
  const generateMessage = () => run('message', async () => {
    const draft = await jobsApi.applicationMessage(job.jobId)
    return { ...job, applicationMessage: draft.message }
  })
  const prepareInterview = () => run('preparation', async () => {
    const match = job.matchAnalysis ?? (await jobsApi.match(job.jobId)).match
    const preparation: InterviewPreparation = {
      preparedAt: new Date().toISOString(),
      focusTopics: [...new Set([...job.technologies, ...job.requiredSkills, ...match.relevantSkills])].slice(0, 8),
      discussionAreas: ['Explain the architecture you would use for this role', 'Discuss trade-offs in the required technologies', 'Describe how you validate and improve your work'],
      resumeEvidence: [...match.relevantProjects, ...match.relevantExperience].length ? [...match.relevantProjects, ...match.relevantExperience] : match.evidence.map(item => `${item.name || item.source}: ${item.text}`),
    }
    return jobsApi.updateApplication(job.jobId, { matchAnalysis: match, interviewPreparation: preparation })
  })

  return <article className="panel saved-job">
    <div className="saved-job-main">
      <div className="saved-job-heading"><div><div className="eyebrow">APPLICATION TRACKING</div><h2>{job.title}</h2><p>{job.company ?? 'Company not listed'} · {job.location ?? 'Location not listed'}</p></div><span className="application-status">{job.status ?? 'SAVED'}</span></div>
      <div className="tracking-dates"><div><small>Saved</small><strong>{job.savedAt ? formatDate(job.savedAt) : 'Date unavailable'}</strong></div><label><small>Applied date</small><input aria-label={`Applied date for ${job.title}`} type="date" value={appliedDate} onChange={event => setAppliedDate(event.target.value)} /><button className="text-button" onClick={saveAppliedDate} disabled={!!pending}>Save date</button></label><label><small>Interview date</small><input aria-label={`Interview date for ${job.title}`} type="date" value={interviewDate} onChange={event => setInterviewDate(event.target.value)} /><button className="text-button" onClick={saveInterviewDate} disabled={!!pending}><CalendarDays size={13}/> Set Interview Date</button></label></div>
      <div className="tracking-availability"><span>Match analysis <strong>{job.matchAnalysis ? 'Available' : 'Not analysed'}</strong></span><span>Application message <strong>{job.applicationMessage ? 'Available' : 'Not generated'}</strong></span><span>Interview preparation <strong>{job.interviewPreparation ? 'Available' : 'Not prepared'}</strong></span></div>
      <div className="tracking-controls"><label>Status<select aria-label={`Status for ${job.title}`} value={selectedStatus} onChange={event => setSelectedStatus(event.target.value as ApplicationStatus)}>{APPLICATION_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></label><button className="button secondary" onClick={updateStatus} disabled={!!pending || selectedStatus === (job.status ?? 'SAVED')}>{pending === 'status' ? 'Updating…' : 'Update Status'}</button><button className="button secondary" onClick={markApplied} disabled={!!pending}>{pending === 'applied' ? 'Updating…' : 'Mark Applied'}</button></div>
      {error && <ErrorNotice text={error} />}
      <div className="saved-job-actions"><button className="button secondary" onClick={analyseMatch} disabled={!!pending}>{pending === 'analysis' ? <LoaderCircle className="spin" size={14}/> : <Sparkles size={14}/>}Analyse Match</button><button className="button secondary" onClick={generateMessage} disabled={!!pending}>{pending === 'message' ? <LoaderCircle className="spin" size={14}/> : <Send size={14}/>}Generate Application Message</button><button className="button secondary" onClick={prepareInterview} disabled={!!pending}>{pending === 'preparation' ? <LoaderCircle className="spin" size={14}/> : <CalendarDays size={14}/>}Prepare Interview</button><button className="text-button" onClick={() => go(`/jobs/${encodeURIComponent(job.jobId)}/analysis`)}>Open job analysis <ChevronRight size={14}/></button></div>
    </div>
  </article>
}

function JobDetail({ jobId, go }: { jobId: string; go: (path: string) => void }) {
  const [job, setJob] = useState<Job | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { let active = true; jobsApi.getJob(jobId).then((value) => { if (active) setJob(value) }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Unable to load job.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [jobId])
  if (loading) return <Loading label="Loading job details…" />
  if (error || !job) return <><button className="back-link" onClick={() => go('/jobs')}><ArrowLeft size={15} /> Back to jobs</button><ErrorNotice text={error || 'Job not found.'} /></>
  return <><button className="back-link" onClick={() => go('/jobs')}><ArrowLeft size={15} /> Back to jobs</button><section className="detail-hero"><div className="company-avatar large">{(job.company || job.title).slice(0, 1).toUpperCase()}</div><div className="detail-title"><div className="eyebrow">JOB DETAILS <span className="source-label">{job.source?.provider}</span></div><h1>{job.title}</h1><p>{[job.company, job.location, job.remote === undefined ? '' : job.remote ? 'Remote' : 'On-site / hybrid'].filter(Boolean).join(' · ')}</p><div className="detail-chips">{job.employmentType && <span className="chip">{job.employmentType}</span>}{job.publishedAt && <span className="chip">Published {formatDate(job.publishedAt)}</span>}</div></div><div className="detail-actions"><button className="button primary" onClick={() => go(`/jobs/${encodeURIComponent(job.jobId)}/analysis`)}><Sparkles size={16} /> Analyse against my resume</button>{job.source?.url && <a className="button secondary" href={job.source.url} target="_blank" rel="noreferrer">View original job <ArrowUpRight size={15} /></a>}</div></section>
    <div className="detail-layout"><section className="panel detail-description"><Section title="Job description">{job.description ? <p className="prose">{job.description}</p> : <p className="muted">No description provided by the source.</p>}</Section></section><section className="panel"><Section title="Responsibilities" items={job.responsibilities} /></section><section className="panel"><Section title="Required skills" items={job.requiredSkills} chips /></section><section className="panel"><Section title="Preferred skills" items={job.preferredSkills} chips /></section><section className="panel"><Section title="Technologies" items={job.technologies} chips /></section><section className="panel"><Section title="Qualifications" items={job.qualifications} /></section><section className="panel"><Section title="Experience requirements" items={job.experienceRequirements} /></section><section className="panel"><Section title="Education requirements" items={job.educationRequirements} /></section></div>
  </>
}

function Section({ title, children, items, chips }: { title: string; children?: React.ReactNode; items?: string[]; chips?: boolean }) {
  return <div className="section"><div className="panel-heading"><h2>{title}</h2>{items && <span className="count-badge">{items.length}</span>}</div>{children ?? (items?.length ? chips ? <div className="chips">{items.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <ul className="bullet-list">{items.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul> : <p className="muted">No {title.toLowerCase()} provided.</p>)}</div>
}

function ApplicationMessageEditor({ job, jobId }: { job: Job | null; jobId: string }) {
  const [messageType, setMessageType] = useState<ApplicationMessageType>('Recruiter message')
  const [company, setCompany] = useState(job?.company ?? '')
  const [companyAddress, setCompanyAddress] = useState('')
  const [recipient, setRecipient] = useState('')
  const [senderName, setSenderName] = useState('')
  const [subject, setSubject] = useState(`Application for ${job?.title ?? 'this role'}`)
  const [draft, setDraft] = useState<ApplicationDraft | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateDraft = async () => {
    setDraftLoading(true)
    setDraftError('')
    setSaved(false)
    try {
      const options: ApplicationMessageOptions = { company, recipient, senderName, ...(messageType === 'Cover letter' ? { companyAddress } : {}), ...(messageType === 'Email' ? { subject } : {}) }
      setDraft(await jobsApi.applicationMessage(jobId, messageType, options))
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Unable to generate an application message.')
    } finally {
      setDraftLoading(false)
    }
  }

  const saveDraft = async () => {
    if (!draft) return
    setSaving(true)
    setDraftError('')
    try {
      await jobsApi.updateApplication(jobId, { applicationMessage: draft.message })
      setSaved(true)
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Unable to save your message edits.')
    } finally {
      setSaving(false)
    }
  }

  const copyDraft = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft.message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setDraftError('Clipboard access is unavailable in this browser.')
    }
  }

  return <section className="panel draft-panel">
    <div className="panel-heading"><div><div className="eyebrow">APPLICATION ASSISTANT</div><h2>Application message</h2></div><span className="draft-label">DRAFT — HUMAN REVIEW REQUIRED</span></div>
    <label className="field-label" htmlFor="message-type">Message type</label>
    <select id="message-type" className="message-type" value={messageType} onChange={event => { setMessageType(event.target.value as ApplicationMessageType); setDraft(null); setSaved(false) }}>{messageTypes.map(type => <option key={type}>{type}</option>)}</select>
    <p className="section-intro">Choose a format, edit the recipient and company details, then review and edit the generated draft. Regenerate after changing these details to apply them to an existing draft.</p>
    <div className="message-options">
      <label>Company name<input value={company} onChange={event => setCompany(event.target.value)} maxLength={300} placeholder="Company or organization" /></label>
      {messageType === 'Cover letter' && <label>Company address<input value={companyAddress} onChange={event => setCompanyAddress(event.target.value)} maxLength={300} placeholder="Street, city, postal code (optional)" /></label>}
      <label>{messageType === 'Email' ? 'Recipient (name or email)' : messageType === 'LinkedIn message' ? 'Recruiter name' : 'Hiring manager / recipient'}<input value={recipient} onChange={event => setRecipient(event.target.value)} maxLength={300} placeholder={messageType === 'Email' ? 'name@company.com' : 'e.g. Jane Smith (optional)'} required={messageType === 'Email'} /></label>
      <label>Your name<input value={senderName} onChange={event => setSenderName(event.target.value)} maxLength={300} placeholder="Name for your sign-off" /></label>
      {messageType === 'Email' && <label>Email subject<input value={subject} onChange={event => setSubject(event.target.value)} maxLength={300} required placeholder="Application for the role" /></label>}
    </div>
    <button className="button primary" onClick={() => void generateDraft()} disabled={draftLoading || (messageType === 'Email' && (!recipient.trim() || !subject.trim()))}>{draftLoading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{draftLoading ? 'Generating application message…' : draft ? 'Regenerate draft' : 'Generate application message'}</button>
    {messageType === 'Email' && (!recipient.trim() || !subject.trim()) && <p className="message-helper">Enter an email recipient and subject to generate an email.</p>}
    {draftError && <ErrorNotice text={draftError} />}
    {draft && <><div className="draft-message">
      <div className="draft-message-head"><strong>{draft.messageType} draft — edit before sending</strong><span>{draft.status}</span></div>
      <label className="message-body-label" htmlFor="application-message-body">Message content</label>
      <textarea id="application-message-body" className="application-message-body" value={draft.message} onChange={event => { setDraft({ ...draft, message: event.target.value }); setSaved(false) }} maxLength={20000} rows={12} />
      <div className="draft-actions">
        <button className="button secondary" onClick={() => void copyDraft()}><Clipboard size={15} />{copied ? 'Copied' : 'Copy message'}</button>
        <button className="button secondary" onClick={() => void saveDraft()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{saving ? 'Saving…' : saved ? 'Edits saved' : 'Save edits'}</button>
        {job?.source?.url && <a className="button primary" href={job.source.url} target="_blank" rel="noreferrer"><ArrowUpRight size={15} />Open original job</a>}
      </div>
    </div><p className="muted">Copy the reviewed message, then submit it through the employer’s application page.</p><div className="evidence-used"><strong>Evidence used</strong>{draft.evidenceUsed.length ? <div className="chips">{draft.evidenceUsed.map(item => <span className="chip" key={item}>{item}</span>)}</div> : <p className="muted">No evidence references were returned.</p>}</div></>}
  </section>
}

function AnalysisPage({ jobId, go, onAnalysed }: { jobId: string; go: (path: string) => void; onAnalysed?: () => void }) {
  const [job, setJob] = useState<Job | null>(null); const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]); const [chatInput, setChatInput] = useState(''); const [chatLoading, setChatLoading] = useState(false); const [chatError, setChatError] = useState('')
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('technical'); const [interviewDifficulty, setInterviewDifficulty] = useState<InterviewDifficulty>('junior'); const [questionCount, setQuestionCount] = useState(10); const [interviewStarting, setInterviewStarting] = useState(false); const [interviewError, setInterviewError] = useState('')
  useEffect(() => { let active = true; Promise.all([jobsApi.getJob(jobId), jobsApi.match(jobId)]).then(([jobResult, matchResult]) => { if (active) { setJob(jobResult); setAnalysis(matchResult.match); onAnalysed?.() } }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Unable to analyse this job. Candidate evidence could not be retrieved.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [jobId])
  const askInterviewCoach = async (question = chatInput) => { const prompt = question.trim(); if (!prompt || chatLoading) return; const history = chatMessages; setChatMessages(current => [...current, { role: 'user', content: prompt }]); setChatInput(''); setChatLoading(true); setChatError(''); try { const response = await jobsApi.interviewChat(jobId, prompt, history); setChatMessages(current => [...current, { role: 'assistant', content: response.answer }]) } catch (e) { setChatMessages(current => current.slice(0, -1)); setChatInput(prompt); setChatError(e instanceof Error ? e.message : 'Unable to get an interview explanation.') } finally { setChatLoading(false) } }
  const startInterview = async () => { setInterviewStarting(true); setInterviewError(''); try { const created = await interviewsApi.create({ jobId, mode: interviewMode, difficulty: interviewDifficulty, totalQuestions: questionCount }); await interviewsApi.start(created.sessionId); go(`/interviews/${encodeURIComponent(created.sessionId)}`) } catch (e) { setInterviewError(e instanceof Error ? e.message : 'Unable to start this interview.') } finally { setInterviewStarting(false) } }
  if (loading) return <Loading label="Analysing job against Resume RAG evidence…" />
  if (error || !analysis) return <><button className="back-link" onClick={() => go(`/jobs/${encodeURIComponent(jobId)}`)}><ArrowLeft size={15} /> Back to job</button><ErrorNotice text={error || 'Analysis unavailable.'} /></>
  const groups = [
    { title: 'Matched', status: 'MATCHED' as const, items: analysis.matchedRequirements, className: 'matched' },
    { title: 'Partial', status: 'PARTIAL' as const, items: analysis.partialRequirements, className: 'partial' },
    { title: 'Not evidenced', status: 'NOT_EVIDENCED' as const, items: analysis.notEvidencedRequirements, className: 'missing' },
  ]
  return <><button className="back-link" onClick={() => go(`/jobs/${encodeURIComponent(jobId)}`)}><ArrowLeft size={15} /> Back to job</button><div className="analysis-heading"><div><div className="eyebrow">RESUME RAG MATCH ANALYSIS</div><h1>{job?.title ?? 'Job analysis'}{job?.company ? <span> at {job.company}</span> : null}</h1><p>{[job?.location, job?.remote === undefined ? '' : job.remote ? 'Remote' : 'On-site / hybrid'].filter(Boolean).join(' · ')}</p></div><span className="analysis-live"><span /> Evidence retrieved</span></div>
    <section className="summary-panel"><div className="summary-spark"><Sparkles size={18} /></div><div><div className="eyebrow">BACKEND ANALYSIS SUMMARY</div><p>{analysis.summary}</p></div></section>
    <div className="analysis-groups">{groups.map((group) => <section className={`panel requirement-group ${group.className}`} key={group.status}><div className="panel-heading"><div className="group-title"><span className="status-symbol">{group.status === 'MATCHED' ? <Check size={15} /> : group.status === 'PARTIAL' ? '◐' : '?'}</span><h2>{group.title}</h2></div><span className="count-badge">{group.items.length}</span></div>{group.items.length ? <div className="requirement-list">{group.items.map((entry, index) => <Requirement key={`${entry.requirement}-${index}`} entry={entry} />)}</div> : <p className="muted">No requirements in this category.</p>}</section>)}</div>
    <section className="panel evidence-panel"><div className="panel-heading"><div><div className="eyebrow">GROUNDED IN YOUR PROFILE</div><h2>Candidate evidence</h2></div><span className="count-badge">{analysis.evidence.length}</span></div><p className="section-intro">Evidence below is returned from your Resume RAG profile. It reflects documented information, not an assessment of undocumented capabilities.</p>{analysis.evidence.length ? <div className="evidence-grid">{analysis.evidence.map((item, i) => <EvidenceCard evidence={item} key={`${item.source}-${item.name}-${i}`} />)}</div> : <div className="empty-inline">No candidate evidence was returned for this analysis.</div>}
      <div className="relevant-grid"><EvidenceList title="Relevant skills" values={analysis.relevantSkills} /><EvidenceList title="Relevant projects" values={analysis.relevantProjects} /><EvidenceList title="Relevant experience" values={analysis.relevantExperience} /><EvidenceList title="Relevant education" values={analysis.relevantEducation} /></div>
    </section>
    <section className="panel prep-panel"><div className="panel-heading"><div><div className="eyebrow">INTERVIEW PREPARATION</div><h2>Prepare for interview</h2></div><span className="draft-label">RESUME EVIDENCE ONLY</span></div><p className="section-intro">Suggested topics to prepare for this role. Treat them as discussion prompts, not claims about your experience.</p><div className="prep-grid"><div><h3>Technical topics</h3><div className="chips">{[...new Set([...(job?.technologies ?? []), ...(job?.requiredSkills ?? []), 'RAG', 'Vector databases', 'Python', 'APIs', 'LLMs'])].slice(0,8).map(x=><span className="chip" key={x}>{x}</span>)}</div></div><div><h3>Likely discussion areas</h3><ul className="bullet-list">{['Explain your RAG architecture','Explain hybrid retrieval','Explain MCP','Explain how you handle hallucinations'].map(x=><li key={x}>{x}</li>)}</ul></div><div><h3>Resume evidence to review</h3><ul className="bullet-list">{[...analysis.relevantProjects,...analysis.relevantExperience].length ? [...analysis.relevantProjects,...analysis.relevantExperience].map(x=><li key={x}>{x}</li>) : analysis.evidence.map((x,i)=><li key={i}>{x.name || x.source}: {x.text}</li>)}</ul>{!analysis.relevantProjects.length && !analysis.relevantExperience.length && !analysis.evidence.length && <p className="muted">No resume evidence returned for this analysis.</p>}</div></div>
      <div className="interview-start"><div className="interview-start-heading"><div><div className="eyebrow">AI INTERVIEWER</div><h3>Practice this interview using your voice.</h3><p>{job?.title ?? 'Selected role'}{job?.company ? ` · ${job.company}` : ''}</p></div><span className="interview-voice-icon"><Volume2 size={19}/></span></div><div className="interview-options"><label>Interview type<select value={interviewMode} onChange={event=>setInterviewMode(event.target.value as InterviewMode)}><option value="technical">Technical Interview</option><option value="behavioral">Behavioral Interview</option><option value="mixed">Mixed Interview</option></select></label><label>Questions<select value={questionCount} onChange={event=>setQuestionCount(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option></select></label><label>Difficulty<select value={interviewDifficulty} onChange={event=>setInterviewDifficulty(event.target.value as InterviewDifficulty)}><option value="junior">Junior</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>{interviewError && <ErrorNotice text={interviewError}/>}<button className="button primary" type="button" onClick={()=>void startInterview()} disabled={interviewStarting}>{interviewStarting?<LoaderCircle className="spin" size={15}/>:<Volume2 size={15}/>} {interviewStarting?'Starting interview…':'Start Voice Interview'}</button></div>
    </section>
    <section className="panel interview-chat-panel"><div className="panel-heading"><div><div className="eyebrow">AI INTERVIEW COACH</div><h2>Learn the topics for this role</h2></div><span className="chat-context-badge"><Sparkles size={12}/> JOB DESCRIPTION CONTEXT</span></div><p className="section-intro">Ask about a technology, concept, or likely interview question. Get a clear explanation with examples tailored to this job description.</p><div className="chat-suggestions">{['Explain RAG in simple terms','How does hybrid retrieval work?','What questions might they ask about APIs?'].map(prompt=><button type="button" key={prompt} className="chip chat-suggestion" onClick={()=>askInterviewCoach(prompt)} disabled={chatLoading}>{prompt}</button>)}</div><div className="chat-thread" aria-live="polite">{chatMessages.length === 0 && <div className="chat-empty"><Sparkles size={17}/><span>Try a suggested question or ask about any topic listed above.</span></div>}{chatMessages.map((message,index)=><div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><strong>{message.role === 'user' ? 'You' : 'Interview coach'}</strong><p>{message.content}</p></div>)}{chatLoading && <div className="chat-message assistant"><strong>Interview coach</strong><p className="chat-thinking"><LoaderCircle className="spin" size={14}/> Preparing an explanation…</p></div>}</div>{chatError && <ErrorNotice text={chatError}/>}<form className="chat-compose" onSubmit={e=>{e.preventDefault();void askInterviewCoach()}}><input aria-label="Ask the interview coach" value={chatInput} onChange={e=>setChatInput(e.target.value)} maxLength={2000} placeholder="Ask about a topic in this job description…" disabled={chatLoading}/><button className="button primary" type="submit" disabled={chatLoading||!chatInput.trim()}>{chatLoading?<LoaderCircle className="spin" size={15}/>:<Send size={15}/>}Ask</button></form><p className="chat-privacy-note">The job description and recent chat messages are sent to the configured Groq AI service to generate replies. The coach explains topics and does not verify your personal experience.</p></section>
    <ApplicationMessageEditor job={job} jobId={jobId} />
  </>
}

function Requirement({ entry }: { entry: RequirementMatch }) {
  const [open, setOpen] = useState(false)
  return <div className="requirement-item"><button className="requirement-toggle" onClick={() => setOpen(!open)} aria-expanded={open}><span>{entry.requirement}</span><ChevronRight className={open ? 'chevron-open' : ''} size={16} /></button>{open && <div className="requirement-evidence">{entry.evidence.length ? entry.evidence.map((e, i) => <EvidenceCard key={`${i}-${e.source}`} evidence={e} />) : <p className="muted">No candidate evidence was found for this requirement. This does not mean the candidate lacks the skill.</p>}</div>}</div>
}

function EvidenceCard({ evidence }: { evidence: CandidateEvidence }) {
  return <article className="evidence-card"><div className="evidence-topline"><span className="evidence-type">{evidence.source.replace('_', ' ')}</span>{evidence.technology && <span className="evidence-tech">{evidence.technology}</span>}</div>{evidence.name && <strong>{evidence.name}</strong>}<p>{evidence.text}</p></article>
}
function EvidenceList({ title, values }: { title: string; values: string[] }) { return <div className="evidence-list-block"><h3>{title}</h3>{values.length ? <ul>{values.map((v, i) => <li key={`${i}-${v}`}>{v}</li>)}</ul> : <p className="muted">No items returned.</p>}</div> }

function IngestPage({ go }: { go: (path: string) => void }) {
  const [url, setUrl] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState<{ jobId: string; title: string; existing: boolean } | null>(null)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); setSuccess(null); let parsed: URL; try { parsed = new URL(url) } catch { setError('Enter a valid public job URL.'); return } if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') { setError('Enter a valid public job URL.'); return } setLoading(true); try { const result = await jobsApi.ingest(url.trim()); setSuccess({ jobId: result.jobId, title: result.job?.title ?? 'Job listing', existing: result.alreadyExisted }) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to ingest this job.') } finally { setLoading(false) } }
  return <><div className="page-heading"><div><div className="eyebrow">BUILD YOUR JOB LIBRARY</div><h1>Add a job listing</h1><p>Send a public job URL to the backend ingestion service. The browser does not scrape job sites.</p></div></div><div className="ingest-layout"><form className="panel ingest-panel" onSubmit={submit}><div className="ingest-icon"><FileSearch size={21} /></div><h2>Ingest a public job</h2><p>The backend will retrieve, parse, and store the listing when the source is supported.</p><label className="field-label" htmlFor="job-url">Job URL</label><input data-testid="ingest-url-input" className="url-input" id="job-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/careers/role" required disabled={loading} /><button data-testid="ingest-submit-button" className="button primary" disabled={loading || !url.trim()}>{loading ? <><LoaderCircle className="spin" size={16} /> Ingesting job…</> : <><ArrowDownLeft size={16} /> Ingest job</>}</button>{error && <ErrorNotice text={error} />}{success && <div data-testid="ingest-success-card" className="success-card"><div className="success-head"><Check size={16} />{success.existing ? 'Job already in your library' : 'Job successfully ingested'}</div><strong>{success.title}</strong><div className="success-actions"><button type="button" className="button secondary" onClick={() => go(`/jobs/${encodeURIComponent(success.jobId)}`)}>View job <ChevronRight size={15} /></button><button type="button" className="text-button" onClick={() => go(`/jobs/${encodeURIComponent(success.jobId)}/analysis`)}>Analyse match <Sparkles size={15} /></button></div></div>}</form><aside className="panel discovery-panel"><div className="eyebrow">OPTIONAL</div><h2>Discover jobs</h2><p>Ask the configured backend job provider to find and ingest listings for a role.</p><DiscoveryControl onDone={(jobId) => go(jobId ? `/jobs/${encodeURIComponent(jobId)}` : '/jobs')} /></aside></div><ResumeIngestPanel /></>
}

function ResumeIngestPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ name: string; role?: string | null } | null>(null)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) return
    setLoading(true); setError(''); setSuccess(null)
    try {
      const result = await jobsApi.ingestResume(file)
      setSuccess({ name: result.data?.name || file.name, role: result.data?.role })
      setFile(null)
      const input = document.getElementById('cv-file') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to ingest this CV.') }
    finally { setLoading(false) }
  }
  return <form className="panel cv-ingest-panel" onSubmit={submit}><div className="cv-heading"><div className="ingest-icon"><FileUp size={21} /></div><div><div className="eyebrow">RESUME PROFILE</div><h2>Ingest your CV</h2><p>Upload a PDF to use it as the latest profile for job comparisons.</p></div></div><div className="cv-upload-row"><label className="field-label" htmlFor="cv-file">CV file (PDF)</label><input className="url-input" id="cv-file" type="file" accept="application/pdf,.pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); setSuccess(null) }} disabled={loading} /><button className="button primary" disabled={loading || !file}>{loading ? <><LoaderCircle className="spin" size={16} /> Ingesting CV…</> : <><FileUp size={16} /> Ingest CV</>}</button></div>{error && <ErrorNotice text={error} />}{success && <div className="success-card"><div className="success-head"><Check size={16} />CV ingested. New job comparisons will use it.</div><strong>{success.name}{success.role ? ` · ${success.role}` : ''}</strong></div>}</form>
}

function DiscoveryControl({ onDone }: { onDone: (jobId?: string) => void }) {
  const [query, setQuery] = useState(''); const [location, setLocation] = useState(''); const [remote, setRemote] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<number | null>(null)
  const run = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(''); setResult(null); try { const response = await jobsApi.discover({ ...(query.trim() ? { query: query.trim() } : {}), ...(location.trim() ? { location: location.trim() } : {}), remote, topK: 10 }); setResult(response.discovered); const first = response.ingested[0]?.jobId; if (response.discovered && first) onDone(first) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to discover jobs.') } finally { setLoading(false) } }
  return <form className="discovery-form" onSubmit={run}><label className="field-label" htmlFor="discover-role">Role or search query</label><input id="discover-role" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="AI Engineer" /><label className="field-label" htmlFor="discover-location">Location</label><input id="discover-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="South Africa" /><label className="check-line"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} /> Remote roles</label><button className="button secondary" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={15} /> Discovering…</> : <><Search size={15} /> Discover jobs</>}</button>{error && <ErrorNotice text={error} />}{result !== null && <p className="success-text">Backend returned {result} {result === 1 ? 'job' : 'jobs'}.</p>}</form>
}

function Loading({ label }: { label: string }) { return <div className="loading-state" role="status"><LoaderCircle className="spin" size={20} />{label}</div> }
function ErrorNotice({ text }: { text: string }) { return <div className="error-notice" role="alert"><CircleHelp size={17} /><span>{text}</span></div> }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) }

export default App
