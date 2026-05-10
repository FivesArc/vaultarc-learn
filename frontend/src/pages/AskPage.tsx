import { useState, useEffect, useRef } from 'react'
import { api, createSession, saveSession, loadSessions, deleteSession } from '../lib/api'
import type { ChatSession, Message } from '../lib/api'
import type { Subject } from '../lib/api'
import type { Note } from '../lib/api'
import { Send, MessageSquare, Trash2, ChevronLeft, Plus, FileText, Layers, BookOpen } from 'lucide-react'
import NoteSelect from '../components/NoteSelect'
import Markdown from 'react-markdown'
import SpeakButton from '../components/SpeakButton'

type ContextType = 'note' | 'section' | 'subject'

export default function AskPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [view, setView] = useState<'list' | 'chat' | 'new'>('list')

  // New chat form state
  const [contextType, setContextType] = useState<ContextType>('note')
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([api.notes.list(), api.subjects.list()]).then(([ns, ss]) => {
      setNotes(ns); setSubjects(ss)
    })
    setSessions(loadSessions())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages])

  const subjectSections = [...new Set(
    notes.filter(n => n.subject_id === selectedSubjectId && n.section).map(n => n.section!)
  )]

  const contextReady = contextType === 'note' ? !!selectedNoteId
    : contextType === 'section' ? !!selectedSubjectId && !!selectedSection
    : !!selectedSubjectId

  function startNewChat() {
    setContextType('note')
    setSelectedNoteId(''); setSelectedSubjectId(''); setSelectedSection('')
    setQuestion(''); setActiveSession(null)
    setView('new')
  }

  function openSession(session: ChatSession) {
    setActiveSession(session)
    setView('chat')
  }

  function removeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteSession(id)
    setSessions(loadSessions())
    if (activeSession?.id === id) { setActiveSession(null); setView('list') }
  }

  function beginChat() {
    if (!contextReady) return
    const note = notes.find(n => n.id === selectedNoteId)
    const subject = subjects.find(s => s.id === selectedSubjectId)

    let label = '', sublabel = ''
    if (contextType === 'note') { label = note?.title ?? ''; sublabel = 'Note' }
    else if (contextType === 'section') { label = selectedSection; sublabel = subject?.name ?? '' }
    else { label = subject?.name ?? ''; sublabel = 'Subject' }

    const session = createSession(contextType, contextType === 'note' ? selectedNoteId : selectedSubjectId, label, sublabel, contextType === 'section' ? selectedSection : undefined)
    setActiveSession(session)
    setView('chat')
  }

  async function ask() {
    if (!activeSession || !question.trim()) return
    const q = question.trim()
    const withUser: ChatSession = {
      ...activeSession,
      messages: [...activeSession.messages, { role: 'user', text: q }]
    }
    setActiveSession(withUser)
    setQuestion('')
    setLoading(true)
    setStreamingText('')

    const ctx = activeSession.type === 'note' ? { note_id: activeSession.contextId }
      : activeSession.type === 'section' ? { subject_id: activeSession.contextId, section: activeSession.section }
      : { subject_id: activeSession.contextId }

    let fullText = ''
    let sources: { id: string; title: string }[] = []

    try {
      await api.askStream(
        ctx, q,
        (token) => {
          fullText += token
          setStreamingText(fullText)
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
        (s) => { sources = s },
      )
      const assistantMsg: Message = { role: 'assistant', text: fullText, sources } as any
      const final: ChatSession = { ...withUser, messages: [...withUser.messages, assistantMsg] }
      setActiveSession(final)
      saveSession(final)
      setSessions(loadSessions())
    } catch (e: any) {
      const errMsg: Message = { role: 'assistant', text: `Error: ${e.message ?? 'Network error'}` }
      const final: ChatSession = { ...withUser, messages: [...withUser.messages, errMsg] }
      setActiveSession(final)
    } finally {
      setLoading(false)
      setStreamingText('')
    }
  }

  function clearSession() {
    if (!activeSession) return
    const cleared = { ...activeSession, messages: [] }
    setActiveSession(cleared)
    saveSession(cleared)
    setSessions(loadSessions())
  }

  // ── Conversation list ─────────────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Ask About Notes</h2>
        <button className="btn-primary" onClick={startNewChat}><Plus size={13} />New Chat</button>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
          <p>No conversations yet. Start a new chat to ask questions about your notes, sections, or subjects.</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={startNewChat}><Plus size={13} />New Chat</button>
        </div>
      ) : (
        <div className="note-list">
          {sessions.map((s) => (
            <div key={s.id} className="note-card" onClick={() => openSession(s)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <MessageSquare size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <h3 style={{ fontSize: 14 }}>{s.label}</h3>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>{s.sublabel}</span>
                  </div>
                  {s.messages.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.messages[s.messages.length - 1].text.slice(0, 80)}…
                    </div>
                  )}
                  <div className="meta" style={{ marginTop: 4 }}>{s.messages.length} message{s.messages.length !== 1 ? 's' : ''}</div>
                </div>
                <button onClick={(e) => removeSession(s.id, e)} className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--danger)', flexShrink: 0 }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── New chat setup ────────────────────────────────────────────────────────
  if (view === 'new') return (
    <div>
      <div className="page-header">
        <button className="btn-ghost" onClick={() => setView('list')} style={{ padding: '5px 12px', fontSize: 13 }}><ChevronLeft size={14} />Back</button>
        <h2 className="page-title">New Chat</h2>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ask about</div>
            <div className="tabs">
              <button className={`tab${contextType === 'note' ? ' active' : ''}`} onClick={() => { setContextType('note'); setSelectedNoteId(''); setSelectedSubjectId(''); setSelectedSection('') }}>
                <FileText size={12} style={{ marginRight: 6 }} />Note
              </button>
              <button className={`tab${contextType === 'section' ? ' active' : ''}`} onClick={() => { setContextType('section'); setSelectedNoteId(''); setSelectedSubjectId(''); setSelectedSection('') }}>
                <Layers size={12} style={{ marginRight: 6 }} />Section
              </button>
              <button className={`tab${contextType === 'subject' ? ' active' : ''}`} onClick={() => { setContextType('subject'); setSelectedNoteId(''); setSelectedSubjectId(''); setSelectedSection('') }}>
                <BookOpen size={12} style={{ marginRight: 6 }} />Subject
              </button>
            </div>
          </div>

          {contextType === 'note' && (
            <NoteSelect notes={notes} subjects={subjects} value={selectedNoteId} onChange={setSelectedNoteId} />
          )}

          {contextType === 'section' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={selectedSubjectId} onChange={(e) => { setSelectedSubjectId(e.target.value); setSelectedSection('') }}>
                <option value="">Select a subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedSubjectId}>
                <option value="">Select a section…</option>
                {subjectSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {contextType === 'subject' && (
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
              <option value="">Select a subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.note_count} notes)</option>)}
            </select>
          )}

          <button className="btn-primary" onClick={beginChat} disabled={!contextReady} style={{ justifyContent: 'center' }}>
            Start Chat
          </button>
        </div>
      </div>
    </div>
  )

  // ── Active chat ────────────────────────────────────────────────────────────
  if (!activeSession) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setView('list')} style={{ padding: '5px 12px', fontSize: 13 }}><ChevronLeft size={14} />Chats</button>
          <div>
            <h2 className="page-title" style={{ fontSize: 15, marginBottom: 0 }}>{activeSession.label}</h2>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeSession.sublabel}</div>
          </div>
        </div>
        {activeSession.messages.length > 0 && (
          <button className="btn-ghost" onClick={clearSession} style={{ fontSize: 12 }}><Trash2 size={12} />Clear</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 16px' }}>
        {activeSession.messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
            Ask anything about <strong>{activeSession.label}</strong>
          </div>
        )}
        {activeSession.messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
            {m.role === 'assistant' && (
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✦</div>
            )}
            <div style={{
              maxWidth: 'min(72%, 600px)', padding: '10px 16px',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: 14, lineHeight: 1.65,
              border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
            }}>
              <div className="chat-md"><Markdown>{m.text}</Markdown></div>
              {m.role === 'assistant' && (
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <SpeakButton text={m.text} size={12} />
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✦</div>
            <div style={{ maxWidth: 'min(72%, 600px)', padding: '10px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.65 }}>
              {streamingText ? (
                <div className="chat-md"><Markdown>{streamingText}</Markdown></div>
              ) : (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: 'pulse 1s ease-in-out 0.2s infinite' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: 'pulse 1s ease-in-out 0.4s infinite' }} />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <input
          placeholder={`Ask about ${activeSession.type === 'note' ? 'this note' : activeSession.type === 'section' ? 'this section' : 'this subject'}…`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button className="btn-primary" onClick={ask} disabled={loading || !question.trim()} style={{ borderRadius: '50%', width: 42, height: 42, padding: 0, justifyContent: 'center', flexShrink: 0 }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
