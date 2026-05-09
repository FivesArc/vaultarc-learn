import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { Note } from '../lib/api'
import { FileText, Plus, Upload, Trash2, Search, Sparkles, X } from 'lucide-react'
import Markdown from 'react-markdown'

type View = 'list' | 'new' | 'edit' | 'upload'

export default function NotesPage() {
  const [view, setView] = useState<View>('list')
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState('')
  const [summarising, setSummarising] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef = useRef<{ title: string; content: string } | null>(null)

  useEffect(() => { loadNotes() }, [])

  useEffect(() => {
    const handler = setTimeout(() => loadNotes(search), 300)
    return () => clearTimeout(handler)
  }, [search])

  async function loadNotes(q?: string) {
    try { setNotes(await api.notes.list(q)) } catch { setError('Failed to load notes') }
  }

  const autoSave = useCallback((t: string, c: string, id?: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (!id) return
      if (savedRef.current?.title === t && savedRef.current?.content === c) return
      setSaving(true)
      try {
        await api.notes.update(id, { title: t, content: c })
        savedRef.current = { title: t, content: c }
      } finally { setSaving(false) }
    }, 1500)
  }, [])

  function handleTitleChange(val: string) {
    setTitle(val)
    if (selected) autoSave(val, content, selected.id)
  }

  function handleContentChange(val: string) {
    setContent(val)
    if (selected) autoSave(title, val, selected.id)
  }

  async function saveNote() {
    if (!title.trim()) return
    setLoading(true)
    try {
      if (selected) {
        await api.notes.update(selected.id, { title, content })
      } else {
        await api.notes.create(title, content)
      }
      await loadNotes()
      goBack()
    } catch { setError('Failed to save note') } finally { setLoading(false) }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    await api.notes.delete(id)
    loadNotes()
    goBack()
  }

  function goBack() {
    setView('list')
    setSelected(null)
    setTitle('')
    setContent('')
    setSummary('')
    savedRef.current = null
  }

  async function openEdit(note: Note) {
    setSelected(note)
    setTitle(note.title)
    setContent('')
    setSummary('')
    setView('edit')
    const full = await api.notes.get(note.id)
    setContent(full.content)
    savedRef.current = { title: note.title, content: full.content }
  }

  async function getSummary() {
    if (!selected) return
    setSummarising(true)
    try {
      const { summary: s } = await api.summary(selected.id)
      setSummary(s)
    } catch (e: any) { setError(e.message) } finally { setSummarising(false) }
  }

  async function handleFileDrop(file: File) {
    setLoading(true)
    try {
      await api.upload(file)
      await loadNotes()
      setView('list')
    } catch { setError('Upload failed') } finally { setLoading(false) }
  }

  if (view === 'upload') return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Upload Notes</h2>
        <button className="btn-ghost" onClick={() => setView('list')}>← Back</button>
      </div>
      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f) }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <div style={{ fontWeight: 600 }}>Drop a file here or click to browse</div>
        <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-muted)' }}>Supports PDF, .txt, .md and other text files</div>
        {loading && <div style={{ marginTop: 16 }}><span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /></div>}
        <input id="file-input" type="file" style={{ display: 'none' }} accept=".pdf,.txt,.md,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }} />
      </div>
    </div>
  )

  if (view === 'new' || view === 'edit') return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="page-title">{view === 'new' ? 'New Note' : 'Edit Note'}</h2>
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saving…</span>}
        </div>
        <button className="btn-ghost" onClick={goBack}>← Back</button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <div className="editor-area">
        <input placeholder="Note title…" value={title} onChange={(e) => handleTitleChange(e.target.value)} style={{ fontSize: 16, fontWeight: 600 }} />
        <textarea placeholder="Write your notes here…" value={content} onChange={(e) => handleContentChange(e.target.value)} style={{ minHeight: 360 }} />
        <div className="editor-toolbar">
          <button className="btn-primary" onClick={saveNote} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Save Note'}
          </button>
          {selected && (
            <button className="btn-ghost" onClick={getSummary} disabled={summarising}>
              <Sparkles size={13} />{summarising ? 'Summarising…' : 'Summarise'}
            </button>
          )}
          {selected && <button className="btn-danger" onClick={() => deleteNote(selected.id)}><Trash2 size={13} />Delete</button>}
        </div>
        {summary && (
          <div className="card" style={{ position: 'relative' }}>
            <button onClick={() => setSummary('')} style={{ position: 'absolute', top: 12, right: 12, padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={14} /></button>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: 'var(--accent)' }}>AI Summary</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}><Markdown>{summary}</Markdown></div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">My Notes</h2>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setView('upload')}><Upload size={13} />Upload</button>
          <button className="btn-primary" onClick={() => { setTitle(''); setContent(''); setSelected(null); setView('new') }}><Plus size={13} />New Note</button>
        </div>
      </div>
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 38 }}
        />
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {notes.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
          <p>{search ? `No notes matching "${search}"` : 'No notes yet. Create one or upload a file.'}</p>
        </div>
      ) : (
        <div className="note-list">
          {notes.map((n) => (
            <div key={n.id} className="note-card" onClick={() => openEdit(n)}>
              <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                <h3>{n.title}</h3>
                {n.source_type === 'upload' && <span className="badge">uploaded</span>}
              </div>
              <div className="meta">{new Date(n.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
