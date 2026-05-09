import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { Note, Subject } from '../lib/api'
import { FileText, Plus, Upload, Trash2, Search, Sparkles, X, Download, Tag, Lightbulb, Link2, BookOpen, FolderOpen, Folder, Pencil, Check } from 'lucide-react'
import Markdown from 'react-markdown'
import { recordAction } from '../lib/gamification'

type View = 'subjects' | 'list' | 'new' | 'edit' | 'upload'

const SUBJECT_COLORS = ['#b87040', '#4a7c5e', '#6a9ec4', '#9b59b6', '#e67e22', '#e74c3c', '#1abc9c', '#3498db']

export default function NotesPage() {
  const [view, setView] = useState<View>('subjects')
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null)
  const [selected, setSelected] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [summarising, setSummarising] = useState(false)
  const [eli5, setEli5] = useState('')
  const [eli5ing, setEli5ing] = useState(false)
  const [connections, setConnections] = useState<{ id: string; title: string }[]>([])
  const [connecting, setConnecting] = useState(false)
  const [keyterms, setKeyterms] = useState<string[]>([])
  const [keytermsLoading, setKeytermsLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  // New subject form
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0])
  const [showNewSubject, setShowNewSubject] = useState(false)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [editingSubjectName, setEditingSubjectName] = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef = useRef<{ title: string; content: string; tags: string } | null>(null)

  useEffect(() => { loadSubjects(); loadTags() }, [])

  useEffect(() => {
    const handler = setTimeout(() => loadNotes(search, activeTag), 300)
    return () => clearTimeout(handler)
  }, [search, activeTag, activeSubject])

  async function loadSubjects() {
    try { setSubjects(await api.subjects.list()) } catch {}
  }

  async function loadNotes(q?: string, tag?: string) {
    try {
      setNotes(await api.notes.list(q, tag, activeSubject?.id))
    } catch { setError('Failed to load notes') }
  }

  async function loadTags() {
    try { setAllTags(await api.notes.tags()) } catch {}
  }

  const autoSave = useCallback((t: string, c: string, tg: string, id?: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (!id) return
      if (savedRef.current?.title === t && savedRef.current?.content === c && savedRef.current?.tags === tg) return
      setSaving(true)
      try {
        await api.notes.update(id, { title: t, content: c, tags: tg })
        savedRef.current = { title: t, content: c, tags: tg }
      } finally { setSaving(false) }
    }, 1500)
  }, [])

  function handleTitleChange(val: string) { setTitle(val); if (selected) autoSave(val, content, tags, selected.id) }
  function handleContentChange(val: string) { setContent(val); if (selected) autoSave(title, val, tags, selected.id) }
  function handleTagsChange(val: string) { setTags(val); if (selected) autoSave(title, content, val, selected.id) }

  async function saveNote() {
    if (!title.trim()) return
    setLoading(true)
    try {
      if (selected) {
        await api.notes.update(selected.id, { title, content, tags })
      } else {
        await api.notes.create(title, content, tags, activeSubject?.id)
      }
      await loadNotes(); await loadTags(); await loadSubjects(); goBack()
    } catch { setError('Failed to save note') } finally { setLoading(false) }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    await api.notes.delete(id)
    loadNotes(); loadTags(); loadSubjects(); goBack()
  }

  function goBack() {
    setView(activeSubject ? 'list' : 'subjects')
    setSelected(null); setTitle(''); setContent(''); setTags('')
    setSummary(''); setEli5(''); setConnections([]); setKeyterms([])
    savedRef.current = null
  }

  async function openEdit(note: Note) {
    setSelected(note); setTitle(note.title); setContent(''); setTags(note.tags || '')
    setSummary(localStorage.getItem(`vaultarc-summary-${note.id}`) || '')
    setEli5(localStorage.getItem(`vaultarc-eli5-${note.id}`) || '')
    setConnections([])
    const savedTerms = localStorage.getItem(`vaultarc-keyterms-${note.id}`)
    setKeyterms(savedTerms ? JSON.parse(savedTerms) : [])
    setView('edit')
    const full = await api.notes.get(note.id)
    setContent(full.content)
    savedRef.current = { title: note.title, content: full.content, tags: note.tags || '' }
  }

  function openSubject(subject: Subject) {
    setActiveSubject(subject)
    setSearch('')
    setActiveTag('')
    setView('list')
  }

  function goToSubjects() {
    setActiveSubject(null)
    setSearch('')
    setActiveTag('')
    setView('subjects')
  }

  async function createSubject() {
    if (!newSubjectName.trim()) return
    const s = await api.subjects.create(newSubjectName.trim(), newSubjectColor)
    setSubjects([...subjects, s])
    setNewSubjectName('')
    setShowNewSubject(false)
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject? Notes will become uncategorized.')) return
    await api.subjects.delete(id)
    loadSubjects()
    if (activeSubject?.id === id) goToSubjects()
  }

  async function saveSubjectName(id: string) {
    if (!editingSubjectName.trim()) return
    await api.subjects.update(id, { name: editingSubjectName.trim() })
    setSubjects(subjects.map((s) => s.id === id ? { ...s, name: editingSubjectName.trim() } : s))
    setEditingSubject(null)
  }

  async function getSummary() {
    if (!selected) return
    setSummarising(true)
    try {
      const { summary: s } = await api.summary(selected.id)
      setSummary(s)
      localStorage.setItem(`vaultarc-summary-${selected.id}`, s)
    } catch (e: any) { setError(e.message) } finally { setSummarising(false) }
  }

  async function getEli5() {
    if (!selected) return
    setEli5ing(true)
    try {
      const { explanation } = await api.eli5(selected.id)
      setEli5(explanation)
      localStorage.setItem(`vaultarc-eli5-${selected.id}`, explanation)
      recordAction('eli5')
    } catch (e: any) { setError(e.message) } finally { setEli5ing(false) }
  }

  async function getConnections() {
    if (!selected) return
    setConnecting(true)
    try {
      const { connections: c } = await api.connections(selected.id)
      setConnections(c)
      recordAction('connections')
    } catch (e: any) { setError(e.message) } finally { setConnecting(false) }
  }

  async function getKeyterms() {
    if (!selected) return
    setKeytermsLoading(true)
    try {
      const { terms } = await api.keyterms(selected.id)
      setKeyterms(terms)
      localStorage.setItem(`vaultarc-keyterms-${selected.id}`, JSON.stringify(terms))
    } catch (e: any) { setError(e.message) } finally { setKeytermsLoading(false) }
  }

  function exportNote() {
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileDrop(file: File) {
    setLoading(true)
    try { await api.upload(file); await loadNotes(); await loadSubjects(); setView(activeSubject ? 'list' : 'subjects') }
    catch (e: any) { setError(e.message || 'Upload failed') } finally { setLoading(false) }
  }

  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)

  // ── Upload view ──────────────────────────────────────────────────────────
  if (view === 'upload') return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Upload Notes</h2>
        <button className="btn-ghost" onClick={() => setView(activeSubject ? 'list' : 'subjects')}>← Back</button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 8, border: '1px solid rgba(184,112,64,0.2)' }}>
        ⚠️ Max file size: 15MB. Very large PDFs will be partially imported.
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

  // ── Edit / New view ──────────────────────────────────────────────────────
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
        <div style={{ position: 'relative' }}>
          <Tag size={13} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-muted)' }} />
          <input placeholder="Tags (comma separated: biology, chapter1)" value={tags} onChange={(e) => handleTagsChange(e.target.value)} style={{ paddingLeft: 36, fontSize: 13 }} />
        </div>
        {tagList.length > 0 && (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {tagList.map((t) => <span key={t} className="badge">{t}</span>)}
          </div>
        )}
        <textarea placeholder="Write your notes here…" value={content} onChange={(e) => handleContentChange(e.target.value)} style={{ minHeight: 400, resize: 'vertical' }} />
        <div className="editor-toolbar">
          <button className="btn-primary" onClick={saveNote} disabled={loading}>{loading ? <span className="spinner" /> : 'Save Note'}</button>
          {selected && <button className="btn-ghost" onClick={getSummary} disabled={summarising}><Sparkles size={13} />{summarising ? 'Summarising…' : 'Summarise'}</button>}
          {selected && <button className="btn-ghost" onClick={getEli5} disabled={eli5ing}><Lightbulb size={13} />{eli5ing ? 'Simplifying…' : 'ELI5'}</button>}
          {selected && <button className="btn-ghost" onClick={getKeyterms} disabled={keytermsLoading}><BookOpen size={13} />{keytermsLoading ? '…' : 'Key Terms'}</button>}
          {selected && <button className="btn-ghost" onClick={getConnections} disabled={connecting}><Link2 size={13} />{connecting ? 'Finding…' : 'Connections'}</button>}
          {selected && <button className="btn-ghost" onClick={exportNote}><Download size={13} />Export .md</button>}
          {selected && <button className="btn-danger" onClick={() => deleteNote(selected.id)}><Trash2 size={13} />Delete</button>}
        </div>

        {keyterms.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Terms</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {keyterms.map((t) => <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(184,112,64,0.3)', fontWeight: 500 }}>{t}</span>)}
            </div>
          </div>
        )}

        {connections.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Related Notes</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {connections.map((c) => <span key={c.id} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(106,158,196,0.12)', color: '#4a7a9e', border: '1px solid rgba(106,158,196,0.3)', fontWeight: 500 }}>🔗 {c.title}</span>)}
            </div>
          </div>
        )}

        {summary && (
          <div className="card" style={{ position: 'relative' }}>
            <button onClick={() => { setSummary(''); if (selected) localStorage.removeItem(`vaultarc-summary-${selected.id}`) }} style={{ position: 'absolute', top: 12, right: 12, padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: 'var(--accent)' }}>AI Summary</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}><Markdown>{summary}</Markdown></div>
          </div>
        )}

        {eli5 && (
          <div className="card" style={{ position: 'relative', borderLeft: '3px solid #e8b84b' }}>
            <button onClick={() => { setEli5(''); if (selected) localStorage.removeItem(`vaultarc-eli5-${selected.id}`) }} style={{ position: 'absolute', top: 12, right: 12, padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#b08020' }}>💡 Explained Simply (ELI5)</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}><Markdown>{eli5}</Markdown></div>
          </div>
        )}
      </div>
    </div>
  )

  // ── Notes list view (inside a subject) ───────────────────────────────────
  if (view === 'list') return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-ghost" onClick={goToSubjects} style={{ padding: '5px 12px', fontSize: 13 }}>← Subjects</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeSubject?.color }} />
            <h2 className="page-title">{activeSubject?.name ?? 'All Notes'}</h2>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setView('upload')}><Upload size={13} />Upload</button>
          <button className="btn-primary" onClick={() => { setTitle(''); setContent(''); setTags(''); setSelected(null); setView('new') }}><Plus size={13} />New Note</button>
        </div>
      </div>
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
      </div>
      {allTags.length > 0 && (
        <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setActiveTag('')} className={activeTag === '' ? 'badge' : 'btn-ghost'} style={{ fontSize: 12, padding: '3px 12px', borderRadius: 999 }}>All</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setActiveTag(activeTag === t ? '' : t)} style={{ fontSize: 12, padding: '3px 12px', borderRadius: 999, background: activeTag === t ? 'var(--accent)' : 'var(--surface2)', color: activeTag === t ? '#fff' : 'var(--text-muted)', border: `1px solid ${activeTag === t ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>{t}</button>
          ))}
        </div>
      )}
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {notes.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
          <p>{search || activeTag ? 'No notes match your filter.' : 'No notes yet. Create one or upload a file.'}</p>
        </div>
      ) : (
        <div className="note-list">
          {notes.map((n) => (
            <div key={n.id} className="note-card" onClick={() => openEdit(n)}>
              <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                <h3>{n.title}</h3>
                {n.source_type === 'upload' && <span className="badge">uploaded</span>}
              </div>
              {n.tags && (
                <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
                  {n.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="badge">{t}</span>)}
                </div>
              )}
              <div className="meta">{new Date(n.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Subjects home view ───────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">My Notes</h2>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setView('upload')}><Upload size={13} />Upload</button>
          <button className="btn-primary" onClick={() => setShowNewSubject(true)}><Plus size={13} />New Subject</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* New subject form */}
      {showNewSubject && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Create New Subject</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input placeholder="Subject name (e.g. CompTIA Security+)" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createSubject()} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SUBJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setNewSubjectColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: newSubjectColor === c ? '3px solid var(--text)' : '2px solid transparent', padding: 0, cursor: 'pointer' }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={createSubject} disabled={!newSubjectName.trim()}>Create</button>
              <button className="btn-ghost" onClick={() => { setShowNewSubject(false); setNewSubjectName('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject grid */}
      {subjects.length === 0 && !showNewSubject ? (
        <div className="empty-state">
          <FolderOpen size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
          <p>No subjects yet. Create one to organise your notes by topic or course.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          {subjects.map((s) => (
            <div key={s.id} className="note-card" style={{ borderLeft: `4px solid ${s.color}`, cursor: 'pointer', position: 'relative' }} onClick={() => openSubject(s)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Folder size={18} style={{ color: s.color, flexShrink: 0 }} />
                {editingSubject === s.id ? (
                  <div style={{ display: 'flex', gap: 6, flex: 1 }} onClick={(e) => e.stopPropagation()}>
                    <input value={editingSubjectName} onChange={(e) => setEditingSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSubjectName(s.id)} style={{ flex: 1, fontSize: 13, padding: '4px 8px' }} autoFocus />
                    <button onClick={() => saveSubjectName(s.id)} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}><Check size={14} /></button>
                  </div>
                ) : (
                  <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{s.name}</h3>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.note_count} note{s.note_count !== 1 ? 's' : ''}</div>
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setEditingSubject(s.id); setEditingSubjectName(s.name) }} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.6 }}><Pencil size={12} /></button>
                <button onClick={() => deleteSubject(s.id)} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uncategorized notes */}
      <UncategorizedSection onOpen={openEdit} />
    </div>
  )
}

function UncategorizedSection({ onOpen }: { onOpen: (n: Note) => void }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api.notes.list(undefined, undefined, 'none').then(setNotes).catch(() => {})
  }, [])

  if (notes.length === 0) return null

  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, marginBottom: 12, padding: 0 }}>
        <FileText size={14} />
        Uncategorized ({notes.length})
        <span style={{ fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="note-list">
          {notes.map((n) => (
            <div key={n.id} className="note-card" onClick={() => onOpen(n)}>
              <h3>{n.title}</h3>
              <div className="meta">{new Date(n.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
