export type VoiceStatus = 'speaking' | 'finished' | 'error'

export type VoiceAnswerRecognitionResultEvent = {
  results: ArrayLike<{ 0?: { transcript: string } }>
}

export type VoiceAnswerRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: VoiceAnswerRecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type VoiceAnswerRecognitionConstructor = new () => VoiceAnswerRecognition
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: VoiceAnswerRecognitionConstructor
  webkitSpeechRecognition?: VoiceAnswerRecognitionConstructor
}

function getVoiceAnswerRecognitionConstructor(): VoiceAnswerRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

export function isVoiceAnswerRecognitionAvailable(): boolean {
  return getVoiceAnswerRecognitionConstructor() !== undefined
}

export function createVoiceAnswerRecognition(): VoiceAnswerRecognition | null {
  const Recognition = getVoiceAnswerRecognitionConstructor()
  return Recognition ? new Recognition() : null
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function speakQuestion(text: string, onStatus: (status: VoiceStatus) => void): boolean {
  if (!isSpeechSynthesisAvailable()) return false

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.onstart = () => onStatus('speaking')
  utterance.onend = () => onStatus('finished')
  utterance.onerror = () => onStatus('error')
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}