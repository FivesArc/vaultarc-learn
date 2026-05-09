import { useState, useEffect, useRef } from 'react'
import { api, loadChatHistory, saveChatHistory, clearChatHistory } from '../lib/api'
import type { Note, Message } from '../lib/api'
import { Send, MessageSquare, Trash2 } from 'lucide-react'
import Markdown from 'react-markdown'

export default function AskPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.notes.list().then(setNotes) }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function selectNote(id: string) {
    setSelectedNoteId(id)
    setMessages(id ? loadChatHistory(id) : [])
  }

  async function ask() {
    if (!selectedNoteId || !question.trim()) return
    const q = question.trim()
    const updated: Message[] = [...messages, { role: 'user', text: q }]
    setMessages(updated)
    setQuestion('')
    setLoading(true)
    try {
      const { answer } = await api.ask(selectedNoteId, q)
      const final: Message[] = [...updated, { role: 'assistant', text: answer }]
      setMessages(final)
      saveChatHistory(selectedNoteId, final)
    } catch (e: any) {
      console.error('Ask error:', e)
      const msg = e.message || e.toString() || 'Network error'
      const final: Message[] = [...updated, { role: 'assistant', text: `Error: ${msg}` }]
      setMessages(final)
    } finally { setLoading(false) }
  }

  function clearHistory() {
    if (!selectedNoteId) return
    clearChatHistory(selectedNoteId)
    setMessages([])
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Ask About Notes</h2>
        {messages.length > 0 && (
          <button className="btn-ghost" onClick={clearHistory} style={{ fontSize: 12 }}>
            <Trash2 size={12} />Clear history
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20, maxWidth: 400 }}>
        <select value={selectedNoteId} onChange={(e) => selectNote(e.target.value)}>
          <option value="">Select a note to ask about…</option>
          {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
      </div>

      {!selectedNoteId ? (
        <div className="empty-state">
          <MessageSquare size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
          <p>Select a note above to start asking questions.</p>
        </div>
      ) : (
        <>
          <div className="qa-thread" style={{ minHeight: 120, marginBottom: 20 }}>
            {messages.length === 0 && (
              <div className="text-muted" style={{ padding: '12px 0' }}>Ask anything about your selected note.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`qa-bubble ${m.role}`}>
                <Markdown>{m.text}</Markdown>
              </div>
            ))}
            {loading && (
              <div className="qa-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Thinking…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="qa-input-row">
            <input
              placeholder="Ask a question about this note…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
              disabled={loading}
            />
            <button className="btn-primary" onClick={ask} disabled={loading || !question.trim()} style={{ borderRadius: '50%', width: 42, height: 42, padding: 0, justifyContent: 'center' }}>
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
