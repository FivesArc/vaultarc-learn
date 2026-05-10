import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { Note, Subject } from '../lib/api'
import { FileText, Plus, Upload, Trash2, Search, Sparkles, X, Download, Tag, Lightbulb, Link2, BookOpen, FolderOpen, Folder, Pencil, Check, Target, Map, Brain } from 'lucide-react'
import Markdown from 'react-markdown'
import MindMap from '../components/MindMap'
import SpeakButton from '../components/SpeakButton'

type View = 'subjects' | 'list' | 'section' | 'new' | 'edit' | 'upload'

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
  const [_allTags, setAllTags] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [summarising, setSummarising] = useState(false)
  const [eli5, setEli5] = useState('')
  const [eli5ing, setEli5ing] = useState(false)
  const [connections, setConnections] = useState<{ id: string; title: string }[]>([])
  const [connecting, setConnecting] = useState(false)
  const [keyterms, setKeyterms] = useState<string[]>([])
  const [keytermsLoading, setKeytermsLoading] = useState(false)
  type PriorityItem = { concept: string; why: string; anchor: string }
  type PriorityResult = { must_know: PriorityItem[]; should_know: PriorityItem[]; nice_to_know: PriorityItem[] }
  const [priorityResult, setPriorityResult] = useState<PriorityResult | null>(null)
  const [priorityLoading, setPriorityLoading] = useState(false)
  type MindMapData = { center: string; branches: { name: string; children: string[] }[] }
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null)
  const [mindMapLoading, setMindMapLoading] = useState(false)
  type TeachBackState = { phase: 'idle' | 'question' | 'answering' | 'feedback'; question: string; answer: string; feedback: { score: string; got_right: string; missed: string; remember: string } | null }
  const [teachBack, setTeachBack] = useState<TeachBackState>({ phase: 'idle', question: '', answer: '', feedback: null })
  const [teachBackLoading, setTeachBackLoading] = useState(false)
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
  const [editingSubjectExam, setEditingSubjectExam] = useState('')
  const [dragOverSubject, setDragOverSubject] = useState<string | null>(null)
  const [noteSubjectId, setNoteSubjectId] = useState<string>('')
  const [noteSection, setNoteSection] = useState<string>('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [subjectSections, setSubjectSections] = useState<string[]>([])
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const [dragOverNoteId, setDragOverNoteId] = useState<string | null>(null)

  function loadSections(subjectId: string) {
    try {
      const raw = localStorage.getItem(`vaultarc-sections-${subjectId}`)
      setSubjectSections(raw ? JSON.parse(raw) : [])
    } catch { setSubjectSections([]) }
  }

  function saveSections(subjectId: string, secs: string[]) {
    localStorage.setItem(`vaultarc-sections-${subjectId}`, JSON.stringify(secs))
    setSubjectSections(secs)
  }
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
        const subjectId = noteSubjectId || activeSubject?.id
        await api.notes.create(title, content, tags, subjectId, noteSection || undefined)
      }
      await loadNotes(); await loadTags(); await loadSubjects(); goBack()
    } catch { setError('Failed to save note') } finally { setLoading(false) }
  }

  async function deleteNote(id: string) {
    const note = notes.find(n => n.id === id)
    const msg = note?.source_type === 'upload'
      ? `Delete "${note.title}"?\n\nThis will permanently delete the note and its uploaded file from storage. This cannot be undone.`
      : `Delete "${note?.title}"?\n\nThis cannot be undone.`
    if (!confirm(msg)) return
    await api.notes.delete(id)
    loadNotes(); loadTags(); loadSubjects(); goBack()
  }

  function goBack() {
    setView(activeSection ? 'section' : activeSubject ? 'list' : 'subjects')
    setSelected(null); setTitle(''); setContent(''); setTags('')
    setSummary(''); setEli5(''); setConnections([]); setKeyterms([]); setPriorityResult(null); setMindMapData(null); setTeachBack({ phase: 'idle', question: '', answer: '', feedback: null })
    savedRef.current = null
  }

  async function openEdit(note: Note) {
    setSelected(note); setTitle(note.title); setContent(''); setTags(note.tags || '')
    setNoteSubjectId(note.subject_id || '')
    setNoteSection(note.section || '')

    setSummary(localStorage.getItem(`vaultarc-summary-${note.id}`) || '')
    setEli5(localStorage.getItem(`vaultarc-eli5-${note.id}`) || '')
    setConnections([])
    const savedTerms = localStorage.getItem(`vaultarc-keyterms-${note.id}`)
    setKeyterms(savedTerms ? JSON.parse(savedTerms) : [])
    const savedPriority = localStorage.getItem(`vaultarc-priority-${note.id}`)
    setPriorityResult(savedPriority ? JSON.parse(savedPriority) : null)
    const savedMindMap = localStorage.getItem(`vaultarc-mindmap-${note.id}`)
    setMindMapData(savedMindMap ? JSON.parse(savedMindMap) : null)
    setTeachBack({ phase: 'idle', question: '', answer: '', feedback: null })
    setView('edit')
    const full = await api.notes.get(note.id)
    setContent(full.content)
    savedRef.current = { title: note.title, content: full.content, tags: note.tags || '' }
  }

  const [uncategorizedRefresh, setUncategorizedRefresh] = useState(0)

  async function renameSection(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) { setEditingSection(null); return }
    const affected = notes.filter(n => (n.section || '') === oldName)
    await Promise.all(affected.map(n => api.notes.update(n.id, { section: newName.trim() })))
    if (activeSubject) {
      const updated = subjectSections.map(s => s === oldName ? newName.trim() : s)
      saveSections(activeSubject.id, updated)
    }
    setEditingSection(null)
    await loadNotes()
  }

  function createSection() {
    if (!newSectionName.trim() || !activeSubject) return
    if (!subjectSections.includes(newSectionName.trim())) {
      saveSections(activeSubject.id, [...subjectSections, newSectionName.trim()])
    }
    setNewSectionName('')
    setShowNewSection(false)
  }

  function deleteSection(name: string) {
    if (!activeSubject) return
    saveSections(activeSubject.id, subjectSections.filter(s => s !== name))
  }

  function getSections(): string[] {
    // All named sections from localStorage (including empty ones), then catch any
    // section names on notes that aren't in the localStorage list yet
    const ordered = [...subjectSections]
    const noteSections = new Set(notes.map(n => n.section).filter(Boolean) as string[])
    for (const s of noteSections) {
      if (!ordered.includes(s)) ordered.push(s)
    }
    return ordered
  }

  async function reorderNotes(dragId: string, overId: string, sectionNotes: Note[]) {
    if (dragId === overId) return
    const order = [...sectionNotes]
    const from = order.findIndex(n => n.id === dragId)
    const to = order.findIndex(n => n.id === overId)
    if (from === -1 || to === -1) return
    order.splice(to, 0, order.splice(from, 1)[0])
    // Optimistically update local state
    setNotes(prev => {
      const others = prev.filter(n => !order.find(o => o.id === n.id))
      return [...others, ...order.map((n, i) => ({ ...n, position: i }))]
    })
    // Persist to DB
    await Promise.all(order.map((n, i) => api.notes.update(n.id, { position: i })))
  }

  async function dropNoteOnSubject(noteId: string, subjectId: string) {
    await api.notes.update(noteId, { subject_id: subjectId })
    await loadSubjects()
    setUncategorizedRefresh((n) => n + 1)
  }

  function openSubject(subject: Subject) {
    setNotes([])
    setSubjectSections([])
    setActiveSubject(subject)
    setActiveSection(null)
    setSearch('')
    setActiveTag('')
    loadSections(subject.id)
    setView('list')
  }

  function openSection(sectionName: string) {
    setActiveSection(sectionName)
    setSearch('')
    setView('section')
  }

  function goToSubjects() {
    setNotes([])
    setSubjectSections([])
    setActiveSubject(null)
    setActiveSection(null)
    setSearch('')
    setActiveTag('')
    setView('subjects')
  }

  function goToList() {
    setActiveSection(null)
    setSearch('')
    setView('list')
  }

  async function createSubject() {
    if (!newSubjectName.trim()) return
    const s = await api.subjects.create(newSubjectName.trim(), newSubjectColor)
    setSubjects([...subjects, s])
    setNewSubjectName('')
    setShowNewSubject(false)
  }

  async function saveSubjectName(id: string) {
    if (!editingSubjectName.trim()) return
    await api.subjects.update(id, { name: editingSubjectName.trim(), exam: editingSubjectExam.trim() || undefined })
    setSubjects(subjects.map((s) => s.id === id ? { ...s, name: editingSubjectName.trim(), exam: editingSubjectExam.trim() || null } : s))
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
    } catch (e: any) { setError(e.message) } finally { setEli5ing(false) }
  }

  async function getConnections() {
    if (!selected) return
    setConnecting(true)
    try {
      const { connections: c } = await api.connections(selected.id)
      setConnections(c)
    } catch (e: any) { setError(e.message) } finally { setConnecting(false) }
  }

  async function getMindMap() {
    if (!selected) return
    setMindMapLoading(true)
    try {
      const result = await api.mindmap(selected.id)
      setMindMapData(result)
      localStorage.setItem(`vaultarc-mindmap-${selected.id}`, JSON.stringify(result))
    } catch (e: any) { setError(e.message) } finally { setMindMapLoading(false) }
  }

  async function startTeachBack() {
    if (!selected) return
    setTeachBackLoading(true)
    try {
      const { question } = await api.teachback.question(selected.id)
      setTeachBack({ phase: 'answering', question, answer: '', feedback: null })
    } catch (e: any) { setError(e.message) } finally { setTeachBackLoading(false) }
  }

  async function submitTeachBack() {
    if (!selected || !teachBack.answer.trim()) return
    setTeachBackLoading(true)
    try {
      const fb = await api.teachback.evaluate(selected.id, teachBack.question, teachBack.answer)
      setTeachBack(prev => ({ ...prev, phase: 'feedback', feedback: fb }))
    } catch (e: any) { setError(e.message) } finally { setTeachBackLoading(false) }
  }

  async function getPriority() {
    if (!selected) return
    setPriorityLoading(true)
    try {
      const result = await api.priority(selected.id)
      setPriorityResult(result)
      localStorage.setItem(`vaultarc-priority-${selected.id}`, JSON.stringify(result))
    } catch (e: any) { setError(e.message) } finally { setPriorityLoading(false) }
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
    try {
      await api.upload(file, undefined, activeSubject?.id, activeSection ?? undefined)
      await loadNotes(); await loadSubjects()
      setView(activeSection ? 'section' : activeSubject ? 'list' : 'subjects')
    }
    catch (e: any) { setError(e.message || 'Upload failed') } finally { setLoading(false) }
  }

  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)

  // ── Upload view ──────────────────────────────────────────────────────────
  if (view === 'upload') return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Upload Notes</h2>
        <button className="btn-ghost" onClick={() => setView(activeSection ? 'section' : activeSubject ? 'list' : 'subjects')}>← Back</button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

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
        <div className="mobile-nav-row">
          <button className="btn-ghost" onClick={goBack} style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }}>←</button>
          <h2 className="page-title">{view === 'new' ? 'New Note' : 'Edit Note'}</h2>
          {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Saving…</span>}
        </div>
        <button className="btn-primary" onClick={saveNote} disabled={loading} style={{ flexShrink: 0 }}>
          {loading ? <span className="spinner" /> : 'Save'}
        </button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <div className="editor-area">
        <input placeholder="Note title…" value={title} onChange={(e) => handleTitleChange(e.target.value)} style={{ fontSize: 16, fontWeight: 600 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
            <Tag size={13} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-muted)' }} />
            <input placeholder="Tags (comma separated)" value={tags} onChange={(e) => handleTagsChange(e.target.value)} style={{ paddingLeft: 36, fontSize: 13 }} />
          </div>
          <select value={noteSubjectId} onChange={async (e) => { setNoteSubjectId(e.target.value); if (selected) { await api.notes.update(selected.id, { subject_id: e.target.value || null }); loadSubjects() } }} style={{ fontSize: 13, flex: '0 0 auto' }}>
            <option value="">Uncategorized</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {noteSubjectId && (
            <>
              <input
                list="section-suggestions"
                placeholder="Section (e.g. Chapter 1)"
                value={noteSection}
                onChange={async (e) => { setNoteSection(e.target.value); if (selected) await api.notes.update(selected.id, { section: e.target.value || null }) }}
                style={{ fontSize: 13, flex: '1 1 180px', minWidth: 0 }}
              />
              <datalist id="section-suggestions">
                {[...new Set(notes.map(n => n.section).filter((s): s is string => !!s))].map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </div>
        {tagList.length > 0 && (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {tagList.map((t) => <span key={t} className="badge">{t}</span>)}
          </div>
        )}
        <textarea placeholder="Write your notes here…" value={content} onChange={(e) => handleContentChange(e.target.value)} style={{ minHeight: 400, resize: 'vertical' }} />

        {(() => {
          const isUpload = selected?.source_type === 'upload'
          const len = content.trim().length
          const tooShort = len < 80
          const needsMore = len < 300

          // Reasons shown as tooltips on disabled buttons
          const shortMsg = 'Add more content before using AI features'
          const uploadMapMsg = 'Mind Map works best with your own structured notes, not uploaded documents'
          const uploadTeachMsg = 'Teach It Back works best with your own notes — write them in your own words first'
          const needsMoreMsg = 'Need at least a paragraph of content for this feature'

          return (
            <div className="editor-toolbar">
              <button className="btn-primary save-desktop" onClick={saveNote} disabled={loading}>{loading ? <span className="spinner" /> : 'Save Note'}</button>

              {selected && (
                <div className="toolbar-group">
                  <button className="btn-ghost" onClick={getSummary}
                    disabled={summarising || tooShort}
                    title={tooShort ? shortMsg : undefined}>
                    <Sparkles size={13} />{summarising ? 'Summarising…' : 'Summarise'}
                  </button>
                  <button className="btn-ghost" onClick={getEli5}
                    disabled={eli5ing || tooShort}
                    title={tooShort ? shortMsg : undefined}>
                    <Lightbulb size={13} />{eli5ing ? 'Simplifying…' : 'Simplify'}
                  </button>
                  <button className="btn-ghost" onClick={getKeyterms}
                    disabled={keytermsLoading || needsMore}
                    title={needsMore ? needsMoreMsg : undefined}>
                    <BookOpen size={13} />{keytermsLoading ? '…' : 'Key Terms'}
                  </button>
                </div>
              )}

              {selected && (
                <div className="toolbar-group">
                  <button className="btn-ghost" onClick={getPriority}
                    disabled={priorityLoading || tooShort}
                    title={tooShort ? shortMsg : undefined}
                    style={{ color: priorityResult ? 'var(--accent)' : undefined, borderColor: priorityResult ? 'var(--accent)' : undefined }}>
                    <Target size={13} />{priorityLoading ? 'Scanning…' : 'What Matters'}
                  </button>
                  <button className="btn-ghost" onClick={getMindMap}
                    disabled={mindMapLoading || tooShort || isUpload}
                    title={isUpload ? uploadMapMsg : tooShort ? shortMsg : undefined}
                    style={{ color: mindMapData ? 'var(--accent)' : undefined, borderColor: mindMapData ? 'var(--accent)' : undefined }}>
                    <Map size={13} />{mindMapLoading ? 'Mapping…' : 'Mind Map'}
                  </button>
                  <button className="btn-ghost" onClick={startTeachBack}
                    disabled={teachBackLoading || tooShort || isUpload}
                    title={isUpload ? uploadTeachMsg : tooShort ? shortMsg : undefined}
                    style={{ color: teachBack.phase !== 'idle' ? 'var(--accent)' : undefined, borderColor: teachBack.phase !== 'idle' ? 'var(--accent)' : undefined }}>
                    <Brain size={13} />{teachBackLoading && teachBack.phase === 'idle' ? 'Loading…' : 'Teach It Back'}
                  </button>
                </div>
              )}

              {selected && (
                <div className="toolbar-group toolbar-group--secondary">
                  <button className="btn-ghost" onClick={getConnections} disabled={connecting}><Link2 size={13} />{connecting ? 'Finding…' : 'Connections'}</button>
                  <button className="btn-ghost" onClick={exportNote}><Download size={13} />Export</button>
                </div>
              )}

              {selected && <button className="btn-danger" onClick={() => deleteNote(selected.id)}><Trash2 size={13} />Delete</button>}
            </div>
          )
        })()}

        {priorityResult && (
          <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🎯 What Matters</div>
              <button onClick={() => { setPriorityResult(null); if (selected) localStorage.removeItem(`vaultarc-priority-${selected.id}`) }} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            {([
              { key: 'must_know', label: 'Must Know', emoji: '🔴', bg: 'rgba(184,64,64,0.06)', border: 'rgba(184,64,64,0.2)', color: '#b84040' },
              { key: 'should_know', label: 'Should Know', emoji: '🟡', bg: 'rgba(230,180,40,0.06)', border: 'rgba(230,180,40,0.25)', color: '#a07010' },
              { key: 'nice_to_know', label: 'Nice to Know', emoji: '⚪', bg: 'rgba(0,0,0,0.02)', border: 'var(--border)', color: 'var(--text-muted)' },
            ] as const).map(({ key, label, emoji, bg, border, color }) => {
              const items = priorityResult[key as keyof typeof priorityResult]
              if (!items?.length) return null
              return (
                <div key={key} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color, marginBottom: 10 }}>{emoji} {label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{item.concept}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.why}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)', background: 'rgba(255,255,255,0.7)', padding: '6px 10px', borderRadius: 6, borderLeft: `3px solid ${color}` }}>
                          💡 {item.anchor}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Mind Map */}
        {mindMapData && mindMapData.branches.length > 0 && (
          <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🗺️ Mind Map</div>
              <button onClick={() => { setMindMapData(null); if (selected) localStorage.removeItem(`vaultarc-mindmap-${selected.id}`) }} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ padding: 16, background: 'var(--surface)', overflowX: 'auto' }}>
              <MindMap center={mindMapData.center} branches={mindMapData.branches} />
            </div>
          </div>
        )}

        {/* Teach It Back */}
        {teachBack.phase !== 'idle' && (
          <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🧠 Teach It Back</div>
              <button onClick={() => setTeachBack({ phase: 'idle', question: '', answer: '', feedback: null })} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ padding: 16, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
                {teachBack.question}
              </div>

              {teachBack.phase === 'answering' && (
                <>
                  <textarea
                    placeholder="Explain it in your own words as if you're teaching someone new to this topic…"
                    value={teachBack.answer}
                    onChange={e => setTeachBack(prev => ({ ...prev, answer: e.target.value }))}
                    style={{ minHeight: 120, resize: 'vertical', fontSize: 14 }}
                  />
                  <button className="btn-primary" onClick={submitTeachBack} disabled={teachBackLoading || !teachBack.answer.trim()} style={{ alignSelf: 'flex-start' }}>
                    {teachBackLoading ? <><span className="spinner" /> Evaluating…</> : 'Submit Answer'}
                  </button>
                </>
              )}

              {teachBack.phase === 'feedback' && teachBack.feedback && (() => {
                const { score, got_right, missed, remember } = teachBack.feedback
                const scoreConfig = {
                  strong: { emoji: '🟢', label: 'Nailed it!', color: '#4a7c5e', bg: 'rgba(74,124,94,0.08)' },
                  partial: { emoji: '🟡', label: 'Getting there', color: '#a07010', bg: 'rgba(230,180,40,0.08)' },
                  needs_work: { emoji: '🔴', label: 'Needs more work', color: '#b84040', bg: 'rgba(184,64,64,0.08)' },
                }[score] ?? { emoji: '🟡', label: 'Reviewed', color: 'var(--accent)', bg: 'var(--accent-light)' }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ padding: '8px 14px', borderRadius: 8, background: scoreConfig.bg, border: `1px solid ${scoreConfig.color}30`, fontWeight: 700, fontSize: 14, color: scoreConfig.color }}>
                      {scoreConfig.emoji} {scoreConfig.label}
                    </div>
                    {got_right && (
                      <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(74,124,94,0.06)', borderLeft: '3px solid #4a7c5e' }}>
                        <span style={{ fontWeight: 600, color: '#4a7c5e' }}>✓ Got right: </span>{got_right}
                      </div>
                    )}
                    {missed && (
                      <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(184,64,64,0.06)', borderLeft: '3px solid #b84040' }}>
                        <span style={{ fontWeight: 600, color: '#b84040' }}>✗ Missed: </span>{missed}
                      </div>
                    )}
                    <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ flex: 1 }}><span style={{ fontWeight: 600, fontStyle: 'normal', color: 'var(--accent)' }}>💡 Remember: </span>{remember}</span>
                      <SpeakButton text={`${got_right ? `You got right: ${got_right}. ` : ''}${missed ? `You missed: ${missed}. ` : ''}Remember: ${remember}`} />
                    </div>
                    <button className="btn-ghost" onClick={startTeachBack} disabled={teachBackLoading} style={{ alignSelf: 'flex-start', fontSize: 12 }}>
                      {teachBackLoading ? 'Loading…' : 'Try another question →'}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {keyterms.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 2 }}>
              <SpeakButton text={keyterms.join(', ')} />
              <button onClick={() => { setKeyterms([]); if (selected) localStorage.removeItem(`vaultarc-keyterms-${selected.id}`) }} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Terms</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {keyterms.map((t) => <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(184,112,64,0.3)', fontWeight: 500 }}>{t}</span>)}
            </div>
          </div>
        )}

        {connections.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', position: 'relative' }}>
            <button onClick={() => setConnections([])} style={{ position: 'absolute', top: 10, right: 10, padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Related Notes</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {connections.map((c) => <span key={c.id} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(106,158,196,0.12)', color: '#4a7a9e', border: '1px solid rgba(106,158,196,0.3)', fontWeight: 500 }}>🔗 {c.title}</span>)}
            </div>
          </div>
        )}

        {summary && (
          <div className="card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 2 }}>
              <SpeakButton text={summary} />
              <button onClick={() => { setSummary(''); if (selected) localStorage.removeItem(`vaultarc-summary-${selected.id}`) }} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: 'var(--accent)' }}>AI Summary</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}><Markdown>{summary}</Markdown></div>
          </div>
        )}

        {eli5 && (
          <div className="card" style={{ position: 'relative', borderLeft: '3px solid #e8b84b' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 2 }}>
              <SpeakButton text={eli5} />
              <button onClick={() => { setEli5(''); if (selected) localStorage.removeItem(`vaultarc-eli5-${selected.id}`) }} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#b08020' }}>💡 Explained Simply (ELI5)</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}><Markdown>{eli5}</Markdown></div>
          </div>
        )}
      </div>
    </div>
  )

  // ── Subject view: section cards grid ────────────────────────────────────
  if (view === 'list') {
    const sections = getSections()
    const unsectionedNotes = notes.filter(n => !n.section)
    return (
      <div>
        <div className="page-header">
          <div className="mobile-nav-row">
            <button className="btn-ghost" onClick={goToSubjects} style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }}>←</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeSubject?.color, flexShrink: 0 }} />
              <h2 className="page-title">{activeSubject?.name ?? 'All Notes'}</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setShowNewSection(true)} style={{ fontSize: 11 }}><Plus size={12} />Section</button>
            <button className="btn-ghost" onClick={() => setView('upload')} style={{ fontSize: 11 }}><Upload size={12} />Upload</button>
            <button className="btn-primary" onClick={() => { setTitle(''); setContent(''); setTags(''); setSelected(null); setView('new') }} style={{ fontSize: 11 }}><Plus size={12} />New Note</button>
          </div>
        </div>

        {showNewSection && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Create New Section</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Section name (e.g. Chapter 1, Week 2)" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createSection()} autoFocus style={{ flex: 1 }} />
              <button className="btn-primary" onClick={createSection} disabled={!newSectionName.trim()}>Create</button>
              <button className="btn-ghost" onClick={() => { setShowNewSection(false); setNewSectionName('') }}>Cancel</button>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

        {sections.filter(s => s).length === 0 && unsectionedNotes.length === 0 ? (
          <div className="empty-state">
            <FileText size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
            <p>No notes yet. Create one or upload a file.</p>
          </div>
        ) : (
          <>
            {/* Section cards */}
            {sections.filter(s => s).length > 0 && (
              <div className="subject-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
                {sections.filter(s => s).map((section) => {
                  const count = notes.filter(n => n.section === section).length
                  const isEditing = editingSection === section
                  return (
                    <div
                      key={section}
                      className="note-card"
                      style={{ borderTop: `4px solid ${activeSubject?.color ?? 'var(--accent)'}`, cursor: isEditing ? 'default' : 'pointer' }}
                      onClick={() => !isEditing && openSection(section)}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input value={editingSectionName} onChange={(e) => setEditingSectionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') renameSection(section, editingSectionName); if (e.key === 'Escape') setEditingSection(null) }} autoFocus style={{ flex: 1, fontSize: 13 }} />
                          <button className="btn-primary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => renameSection(section, editingSectionName)}>Save</button>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setEditingSection(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                            <Folder size={20} style={{ color: activeSubject?.color ?? 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{section}</h3>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{count} note{count !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setEditingSection(section); setEditingSectionName(section) }} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}><Pencil size={11} />Rename</button>
                            <button onClick={() => deleteSection(section)} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}><X size={11} />Remove</button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Unsectioned notes */}
            {unsectionedNotes.length > 0 && (
              <>
                {sections.filter(s => s).length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Unsectioned</span>
                    <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  </div>
                )}
                <div className="note-list">
                  {unsectionedNotes.map((n) => (
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
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Section view: notes inside a section ─────────────────────────────────
  if (view === 'section') {
    const sectionNotes = notes.filter(n => n.section === activeSection)
    return (
      <div>
        <div className="page-header">
          <div className="mobile-nav-row">
            <button className="btn-ghost" onClick={goToList} style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }}>←</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <Folder size={14} style={{ color: activeSubject?.color ?? 'var(--accent)', flexShrink: 0 }} />
              <h2 className="page-title">{activeSection}</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setView('upload')} style={{ fontSize: 11 }}><Upload size={12} />Upload</button>
            <button className="btn-primary" onClick={() => { setTitle(''); setContent(''); setTags(''); setNoteSection(activeSection ?? ''); setSelected(null); setView('new') }} style={{ fontSize: 11 }}><Plus size={12} />New Note</button>
          </div>
        </div>

        <div style={{ marginBottom: 16, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

        {sectionNotes.length === 0 ? (
          <div className="empty-state">
            <FileText size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
            <p>{search ? 'No notes match your search.' : 'No notes in this section yet.'}</p>
          </div>
        ) : (
          <div className="note-list">
            {sectionNotes.map((n) => (
              <div
                key={n.id}
                className="note-card"
                draggable
                onDragStart={() => setDraggingNoteId(n.id)}
                onDragEnd={() => { setDraggingNoteId(null); setDragOverNoteId(null) }}
                onDragOver={(e) => { e.preventDefault(); setDragOverNoteId(n.id) }}
                onDrop={(e) => { e.preventDefault(); if (draggingNoteId) reorderNotes(draggingNoteId, n.id, sectionNotes) }}
                onClick={() => openEdit(n)}
                style={{
                  cursor: 'grab',
                  opacity: draggingNoteId === n.id ? 0.4 : 1,
                  outline: dragOverNoteId === n.id && draggingNoteId !== n.id ? '2px dashed var(--accent)' : 'none',
                  transition: 'opacity 0.15s, outline 0.1s',
                }}
              >
                <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', userSelect: 'none', flexShrink: 0 }}>⠿</span>
                  <h3>{n.title}</h3>
                  {n.source_type === 'upload' && <span className="badge">uploaded</span>}
                </div>
                {n.tags && (
                  <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
                    {n.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="badge">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

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
        <div className="subject-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', maxWidth: '100%', gap: 18, marginBottom: 32 }}>
          {subjects.map((s) => (
            <div
              key={s.id}
              className="note-card"
              style={{ borderTop: `3px solid ${s.color}`, cursor: 'pointer', outline: dragOverSubject === s.id ? `2px dashed ${s.color}` : 'none', background: dragOverSubject === s.id ? `${s.color}12` : undefined, boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.07)` }}
              onClick={() => openSubject(s)}
              onDragOver={(e) => { e.preventDefault(); setDragOverSubject(s.id) }}
              onDragLeave={() => setDragOverSubject(null)}
              onDrop={(e) => { e.preventDefault(); setDragOverSubject(null); const noteId = e.dataTransfer.getData('noteId'); if (noteId) dropNoteOnSubject(noteId, s.id) }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <Folder size={20} style={{ color: s.color, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingSubject === s.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <input value={editingSubjectName} onChange={(e) => setEditingSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSubjectName(s.id)} style={{ fontSize: 13, padding: '4px 8px' }} autoFocus placeholder="Subject name" />
                      <input value={editingSubjectExam} onChange={(e) => setEditingSubjectExam(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSubjectName(s.id)} style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Exam (e.g. CompTIA Security+ SY0-701)" />
                      <button onClick={() => saveSubjectName(s.id)} className="btn-primary" style={{ fontSize: 12, padding: '4px 10px', alignSelf: 'flex-start' }}><Check size={12} />Save</button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{s.name}</h3>
                      {s.exam && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>🎯 {s.exam}</div>}
                    </>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.note_count} note{s.note_count !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={(e) => { e.stopPropagation(); setEditingSubject(s.id); setEditingSubjectName(s.name); setEditingSubjectExam(s.exam ?? '') }} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}><Pencil size={11} />Rename</button>
                {s.note_count === 0 && (
                  <button onClick={async (e) => { e.stopPropagation(); if (confirm('Delete this subject?')) { await api.subjects.delete(s.id); loadSubjects() } }} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger)' }}><Trash2 size={11} />Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uncategorized notes */}
      <UncategorizedSection key={uncategorizedRefresh} onOpen={openEdit} />
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
            <div
              key={n.id}
              className="note-card"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('noteId', n.id)}
              onClick={() => onOpen(n)}
              style={{ cursor: 'grab' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>⠿</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{n.title}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
