import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Keyboard, LoaderCircle, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { interviewsApi } from './services/interviewsApi'
import { createVoiceAnswerRecognition, isSpeechSynthesisAvailable, isVoiceAnswerRecognitionAvailable, speakQuestion, stopSpeaking } from './services/voiceService'
import type { VoiceAnswerRecognition } from './services/voiceService'
import type { InterviewAnswerEvaluation, InterviewFeedback, InterviewQuestion, InterviewSession } from './types/interview'

export function InterviewPage({ sessionId, go }: { sessionId: string; go: (path: string) => void }) {
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [question, setQuestion] = useState<InterviewQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [answerMode, setAnswerMode] = useState<'type' | 'voice'>('type')
  const [voiceAnswerAvailable] = useState(isVoiceAnswerRecognitionAvailable)
  const [recording, setRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [evaluation, setEvaluation] = useState<InterviewAnswerEvaluation | null>(null)
  const [nextQuestion, setNextQuestion] = useState<InterviewQuestion | null>(null)
  const [answerComplete, setAnswerComplete] = useState(false)
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState('Preparing question audio…')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')
  const voiceRecognition = useRef<VoiceAnswerRecognition | null>(null)

  useEffect(() => {
    return () => {
      voiceRecognition.current?.abort()
      voiceRecognition.current = null
    }
  }, [])

  useEffect(() => {
    let active = true
    interviewsApi.get(sessionId).then((loaded) => {
      if (!active) return
      setSession(loaded)
      if (loaded.status === 'completed') setFeedback(loaded.overallFeedback ?? null)
      const activeQuestion = loaded.questions.find(item => item.questionNumber === loaded.currentQuestion && !item.answerTranscript)
      if (activeQuestion) setQuestion(activeQuestion)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load this interview.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId])

  useEffect(() => {
    if (!question || !voiceEnabled || !isSpeechSynthesisAvailable()) return
    speakQuestion(question.question, status => {
      setVoiceStatus(status === 'speaking' ? 'Speaking question…' : status === 'finished' ? 'Question read aloud' : 'Audio playback failed. Read the question below.')
    })
    return () => stopSpeaking()
  }, [question, voiceEnabled])

  const replayQuestion = () => {
    if (!question) return
    speakQuestion(question.question, status => setVoiceStatus(status === 'speaking' ? 'Speaking question…' : status === 'finished' ? 'Question read aloud' : 'Audio playback failed. Read the question below.'))
  }

  const startVoiceRecording = () => {
    const recognition = createVoiceAnswerRecognition()
    if (!recognition) {
      setVoiceError('Voice recording is not supported in this browser. You can type your answer instead.')
      return
    }

    const answerBeforeRecording = answer.trim()
    setVoiceError('')
    setRecordingStatus('Listening… speak your answer.')
    stopSpeaking()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-ZA'
    recognition.onresult = event => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? '').join(' ').trim()
      setAnswer([answerBeforeRecording, transcript].filter(Boolean).join(' ').slice(0, 12000))
    }
    recognition.onerror = event => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was denied. Allow microphone access in your browser or type your answer.',
        'service-not-allowed': 'The browser speech recognition service is unavailable. You can type your answer instead.',
        'audio-capture': 'No microphone was found. Connect a microphone or type your answer.',
        'no-speech': 'No speech was detected. Try recording again or type your answer.',
        network: 'Speech recognition could not connect. Check your connection or type your answer.',
      }
      setVoiceError(messages[event.error] ?? 'Voice recognition failed. Try again or type your answer.')
      setRecordingStatus('Recording stopped.')
      setRecording(false)
    }
    recognition.onend = () => {
      setRecording(false)
      setRecordingStatus(status => status.startsWith('Listening') ? 'Recording stopped. Review your transcript below.' : status)
    }
    voiceRecognition.current?.abort()
    voiceRecognition.current = recognition
    try {
      recognition.start()
      setRecording(true)
    } catch {
      setVoiceError('Could not start voice recognition. Check microphone access or type your answer.')
      setRecordingStatus('Recording stopped.')
      setRecording(false)
      voiceRecognition.current = null
    }
  }

  const stopVoiceRecording = () => {
    voiceRecognition.current?.stop()
    setRecording(false)
    setRecordingStatus('Recording stopped. Review your transcript below.')
  }

  const submitAnswer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!question || !answer.trim() || submitting || recording) return
    setSubmitting(true)
    setError('')
    try {
      const result = await interviewsApi.answer(sessionId, question.questionNumber, answer.trim())
      setEvaluation(result.evaluation)
      setNextQuestion(result.nextQuestion ?? null)
      setAnswerComplete(result.completed)
      setSession(await interviewsApi.get(sessionId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit this answer.')
    } finally {
      setSubmitting(false)
    }
  }

  const continueInterview = () => {
    if (!nextQuestion) return
    setQuestion(nextQuestion)
    setNextQuestion(null)
    setEvaluation(null)
    setAnswer('')
    setAnswerMode('type')
    setRecordingStatus('')
    setVoiceError('')
    setAnswerComplete(false)
  }

  const completeInterview = async () => {
    setCompleting(true)
    setError('')
    try {
      const result = await interviewsApi.complete(sessionId)
      setFeedback(result.feedback)
      setSession(current => current ? { ...current, status: 'completed', overallFeedback: result.feedback } : current)
      setQuestion(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to complete this interview.')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) return <div className="interview-loading"><LoaderCircle className="spin" size={19}/> Loading interview…</div>
  if (error && !session) return <><button className="back-link" onClick={() => go('/jobs')}><ArrowLeft size={15}/> Back to jobs</button><div className="interview-error" role="alert">{error}</div></>
  if (!session) return null

  const topics = Object.entries(session.topics)
  const progress = Math.min(session.currentQuestion / session.totalQuestions * 100, 100)
  const visibleVoiceStatus = !voiceEnabled ? 'Voice muted. Read the question below.' : !isSpeechSynthesisAvailable() ? 'Speech synthesis unavailable. Read the question below.' : voiceStatus
  return <>
    <button className="back-link" onClick={() => go(`/jobs/${encodeURIComponent(session.jobId)}/analysis`)}><ArrowLeft size={15}/> Back to interview preparation</button>
    <div className="interview-page-heading"><div><div className="eyebrow">AI INTERVIEWER</div><h1>{session.jobTitle}</h1><p>{session.company ?? 'Interview practice'} · {session.mode[0].toUpperCase() + session.mode.slice(1)} Interview</p></div><span className="interview-session-label">{session.difficulty} · {session.totalQuestions} questions</span></div>
    {feedback ? <section className="interview-report"><div className="eyebrow">FINAL INTERVIEW REPORT</div><h2>Practice session complete</h2><FeedbackList title="Strengths" items={feedback.strengths}/><FeedbackList title="Topics to review" items={feedback.topicsToReview}/><FeedbackList title="Technical areas" items={feedback.technicalAreas}/><FeedbackList title="Communication areas" items={feedback.communicationAreas}/><FeedbackList title="Recommended practice" items={feedback.recommendedPractice}/></section> : <div className="interview-layout">
      <section className="interview-session-panel">
        <div className="interview-question-meta"><span>Question {session.currentQuestion} of {session.totalQuestions}</span><button type="button" className="interview-voice-toggle" title={voiceEnabled ? 'Mute AI voice' : 'Unmute AI voice'} aria-label={voiceEnabled ? 'Mute AI voice' : 'Unmute AI voice'} onClick={()=>setVoiceEnabled(enabled=>!enabled)}>{voiceEnabled?<Volume2 size={17}/>:<VolumeX size={17}/>}</button></div>
        <div className="interview-question" aria-live="polite">{question?.question ?? 'Preparing your next question…'}</div>
        <div className="voice-status" role="status"><span className={visibleVoiceStatus.startsWith('Speaking')?'voice-status-dot active':''}/>{visibleVoiceStatus}</div>
        <button type="button" className="text-button replay-question" onClick={replayQuestion} disabled={!question || !voiceEnabled || !isSpeechSynthesisAvailable()}><Volume2 size={15}/> Replay question</button>
        {evaluation ? <div className="answer-feedback"><div className="eyebrow">ANSWER FEEDBACK · {evaluation.grounding.replace('_', ' ')}</div><FeedbackList title="What went well" items={evaluation.strengths}/><FeedbackList title="To improve" items={evaluation.improvements}/></div> : <form className="interview-answer" onSubmit={event=>void submitAnswer(event)}>
          <div className="answer-mode-toggle" role="group" aria-label="Choose how to answer">
            <button type="button" className={answerMode === 'type' ? 'active' : ''} aria-pressed={answerMode === 'type'} disabled={recording || submitting} onClick={() => setAnswerMode('type')}><Keyboard size={14}/> Type answer</button>
            <button type="button" className={answerMode === 'voice' ? 'active' : ''} aria-pressed={answerMode === 'voice'} disabled={!voiceAnswerAvailable || recording || submitting} title={!voiceAnswerAvailable ? 'Voice input is not supported in this browser' : undefined} onClick={() => setAnswerMode('voice')}><Mic size={14}/> Record voice</button>
          </div>
          {!voiceAnswerAvailable && <div className="voice-support-note answer-voice-unavailable" role="status">Voice recording is not available in this browser. You can type your answer.</div>}
          {answerMode === 'voice' && <div className="voice-answer-controls">
            <p>Your voice is transcribed into editable text. Review it before submitting.</p>
            <button type="button" className={`button ${recording ? 'voice-recording' : 'voice-record'}`} onClick={recording ? stopVoiceRecording : startVoiceRecording} disabled={!question || submitting || !voiceAnswerAvailable}>
              {recording ? <><MicOff size={15}/> Stop recording</> : <><Mic size={15}/> Start recording</>}
            </button>
            {recordingStatus && <span className="voice-recording-status" role="status">{recordingStatus}</span>}
            {voiceError && <div className="interview-error voice-answer-error" role="alert">{voiceError}</div>}
          </div>}
          <label htmlFor="interview-answer">{answerMode === 'voice' ? 'Your answer transcript' : 'Your answer'}</label>
          <textarea id="interview-answer" value={answer} onChange={event=>setAnswer(event.target.value)} maxLength={12000} placeholder={answerMode === 'voice' ? 'Your spoken answer will appear here…' : 'Type your answer here…'} disabled={!question || submitting || recording} rows={5}/>
          <div className="interview-answer-footer"><span>{answer.length}/12000</span><button className="button primary" type="submit" disabled={!answer.trim() || submitting || recording}>{submitting?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} {submitting?'Evaluating…':'Submit answer'}</button></div>
        </form>}
        {error && <div className="interview-error" role="alert">{error}</div>}
        {evaluation && nextQuestion && <button type="button" className="button primary interview-continue" onClick={continueInterview}>Continue to next question <ArrowLeft className="continue-arrow" size={15}/></button>}
        {evaluation && answerComplete && <button type="button" className="button primary interview-continue" onClick={()=>void completeInterview()} disabled={completing}>{completing?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} {completing?'Building report…':'End interview and view report'}</button>}
      </section>
      <aside className="interview-progress-panel"><div className="eyebrow">INTERVIEW PROGRESS</div><div className="progress-track"><span style={{width:`${progress}%`}}/></div><p className="progress-count">{session.currentQuestion} / {session.totalQuestions}</p><h2>Topics covered</h2><ul className="topic-progress">{topics.length ? topics.map(([topic, status])=><li key={topic} className={status}><span>{status==='covered'?<Check size={13}/>:status==='partial'?'◐':'○'}</span>{topic}</li>) : <li className="not_covered">Topics will appear as questions are asked.</li>}</ul></aside>
    </div>}
  </>
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return <div className="feedback-list"><h3>{title}</h3><ul>{items.map((item, index)=><li key={`${title}-${index}`}>{item}</li>)}</ul></div>
}