import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { Note } from '../lib/api'
import { Send, MessageSquare } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; text: string }

export default function AskPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.notes.list().then(setNotes) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function ask() {
    if (!selectedNoteId || !question.trim()) return
    const q = question.trim()
    setMessages((m) => [...m, { role: 'user', text: q }])
    setQuestion('')
    setLoading(true)
    try {
      const { answer } = await api.ask(selectedNoteId, q)
      setMessages((m) => [...m, { role: 'assistant', text: answer }])
    } catch (e: any) {
      console.error('Ask error:', e)
      const msg = e.message || e.toString() || 'Network error — check browser console'
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${msg}` }])
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Ask About Notes</h2>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 400 }}>
        <select value={selectedNoteId} onChange={(e) => { setSelectedNoteId(e.target.value); setMessages([]) }}>
          <option value="">Select a note to ask about...</option>
          {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
      </div>

      {!selectedNoteId ? (
        <div className="empty-state">
          <MessageSquare size={40} style={{ margin: '0 auto' }} />
          <p>Select a note above to start asking questions.</p>
        </div>
      ) : (
        <>
          <div className="qa-thread" style={{ minHeight: 200, marginBottom: 20 }}>
            {messages.length === 0 && (
              <div className="text-muted" style={{ padding: '20px 0' }}>Ask anything about your selected note.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`qa-bubble ${m.role}`} style={{ whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
            ))}
            {loading && <div className="qa-bubble assistant"><span className="spinner" /></div>}
            <div ref={bottomRef} />
          </div>
          <div className="qa-input-row">
            <input
              placeholder="Ask a question about this note..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
              disabled={loading}
            />
            <button className="btn-primary" onClick={ask} disabled={loading || !question.trim()}>
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
