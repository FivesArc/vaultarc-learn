import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note } from '../lib/api'
import { FileText, Plus, Upload, Trash2, Save } from 'lucide-react'

type View = 'list' | 'new' | 'edit' | 'upload'

export default function NotesPage() {
  const [view, setView] = useState<View>('list')
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    try { setNotes(await api.notes.list()) } catch { setError('Failed to load notes') }
  }

  async function saveNote() {
    if (!title.trim() || !content.trim()) return
    setLoading(true)
    try {
      if (selected) {
        await api.notes.update(selected.id, { title, content })
      } else {
        await api.notes.create(title, content)
      }
      await loadNotes()
      setView('list')
      setTitle('')
      setContent('')
      setSelected(null)
    } catch { setError('Failed to save note') } finally { setLoading(false) }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    await api.notes.delete(id)
    loadNotes()
    if (selected?.id === id) { setSelected(null); setView('list') }
  }

  function openEdit(note: Note) {
    setSelected(note)
    setTitle(note.title)
    setContent(note.content)
    setView('edit')
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
        <h2>Upload Notes</h2>
        <button className="btn-ghost" onClick={() => setView('list')}>← Back</button>
      </div>
      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f) }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload size={32} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 600 }}>Drop a file here or click to browse</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Supports .txt, .md, and other text files</div>
        {loading && <div style={{ marginTop: 16 }}><span className="spinner" /></div>}
        <input id="file-input" type="file" style={{ display: 'none' }} accept=".txt,.md,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }} />
      </div>
    </div>
  )

  if (view === 'new' || view === 'edit') return (
    <div>
      <div className="page-header">
        <h2>{view === 'new' ? 'New Note' : 'Edit Note'}</h2>
        <button className="btn-ghost" onClick={() => { setView('list'); setSelected(null); setTitle(''); setContent('') }}>← Back</button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      <div className="editor-area">
        <input placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Write your notes here..." value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 400 }} />
        <div className="editor-toolbar">
          <button className="btn-primary" onClick={saveNote} disabled={loading}>
            {loading ? <span className="spinner" /> : <><Save size={14} style={{ marginRight: 6 }} />Save Note</>}
          </button>
          {selected && <button className="btn-danger" onClick={() => deleteNote(selected.id)}><Trash2 size={14} style={{ marginRight: 6 }} />Delete</button>}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2>My Notes</h2>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => { setView('upload') }}><Upload size={14} style={{ marginRight: 6 }} />Upload</button>
          <button className="btn-primary" onClick={() => { setTitle(''); setContent(''); setSelected(null); setView('new') }}><Plus size={14} style={{ marginRight: 6 }} />New Note</button>
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      {notes.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} style={{ margin: '0 auto' }} />
          <p>No notes yet. Create one or upload a file.</p>
        </div>
      ) : (
        <div className="note-list">
          {notes.map((n) => (
            <div key={n.id} className="note-card" onClick={() => openEdit(n)}>
              <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                <h3>{n.title}</h3>
                {n.source_type === 'upload' && <span className="badge upload">uploaded</span>}
              </div>
              <div className="meta">
                {n.content.slice(0, 120)}{n.content.length > 120 ? '…' : ''}
              </div>
              <div className="meta" style={{ marginTop: 6 }}>
                {new Date(n.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
