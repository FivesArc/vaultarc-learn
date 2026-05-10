import { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

interface Props {
  text: string
  size?: number
}

export default function SpeakButton({ text, size = 13 }: Props) {
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Stop if text changes or component unmounts
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [text])

  async function toggle() {
    if (!window.speechSynthesis) return

    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }

    // Strip markdown syntax before speaking
    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[-•]\s/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 0.92
    utterance.pitch = 1

    // Prefer high-quality neural/natural voices
    // Voices may not be loaded yet — wait if needed
    let voices = window.speechSynthesis.getVoices()
    if (!voices.length) {
      await new Promise<void>(res => { window.speechSynthesis.onvoiceschanged = () => res() })
      voices = window.speechSynthesis.getVoices()
    }
    const preferred = voices.find(v =>
      /aria|jenny|natasha|samantha|google uk english female|google us english/i.test(v.name)
    ) ?? voices.find(v =>
      /neural|natural|enhanced|premium/i.test(v.name) && /en/i.test(v.lang)
    ) ?? voices.find(v => /en[-_]?(US|GB|AU)/i.test(v.lang) && !v.localService)
      ?? voices.find(v => /en/i.test(v.lang))
    if (preferred) utterance.voice = preferred

    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    utteranceRef.current = utterance

    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  if (!('speechSynthesis' in window)) return null

  return (
    <button
      onClick={toggle}
      title={speaking ? 'Stop reading' : 'Read aloud'}
      style={{
        padding: 4,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: speaking ? 'var(--accent)' : 'var(--text-muted)',
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        transition: 'color 0.15s',
      }}
    >
      {speaking ? <VolumeX size={size} /> : <Volume2 size={size} />}
    </button>
  )
}
