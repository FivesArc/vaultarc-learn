import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note, Flashcard } from '../lib/api'
import { loadDeck, saveDeck, getDueCards, initCard, rateCard } from '../lib/srs'
import type { CardState } from '../lib/srs'
import { Layers, ChevronLeft, ChevronRight, RotateCcw, Zap, Brain, BookOpen } from 'lucide-react'
import NoteSelect from '../components/NoteSelect'

type Tab = 'generate' | 'review-all'
type Mode = 'setup' | 'browse' | 'review' | 'global-review'

// Card with its source noteId so we can save it back to the right deck
type GlobalCard = CardState & { noteId: string }

export default function FlashcardsPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<import('../lib/api').Subject[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [count, setCount] = useState(10)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [deck, setDeck] = useState<CardState[]>([])
  const [dueCards, setDueCards] = useState<CardState[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('setup')
  const [globalCards, setGlobalCards] = useState<GlobalCard[]>([])
  const [globalIndex, setGlobalIndex] = useState(0)
  const [globalFlipped, setGlobalFlipped] = useState(false)
  const [totalGlobalDue, setTotalGlobalDue] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('generate')
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<string>(
    () => localStorage.getItem('vaultarc-review-subject') ?? ''
  )

  useEffect(() => {
    api.notes.list().then(setNotes)
    api.subjects.list().then(setSubjects)
  }, [])

  useEffect(() => {
    if (selectedNoteId) {
      const d = loadDeck(selectedNoteId)
      setDeck(d)
      setDueCards(getDueCards(d))
    }
  }, [selectedNoteId])

  // Count total due cards, respecting subject filter
  useEffect(() => {
    if (notes.length === 0) return
    const filtered = reviewSubjectFilter
      ? notes.filter(n => n.subject_id === reviewSubjectFilter)
      : notes
    const total = filtered.reduce((acc, n) => acc + getDueCards(loadDeck(n.id)).length, 0)
    setTotalGlobalDue(total)
  }, [notes, reviewSubjectFilter])

  function startGlobalReview() {
    const filtered = reviewSubjectFilter
      ? notes.filter(n => n.subject_id === reviewSubjectFilter)
      : notes
    const all: GlobalCard[] = []
    for (const n of filtered) {
      const due = getDueCards(loadDeck(n.id))
      due.forEach(c => all.push({ ...c, noteId: n.id }))
    }
    // Shuffle so it's mixed
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]]
    }
    setGlobalCards(all)
    setGlobalIndex(0)
    setGlobalFlipped(false)
    setMode('global-review')
  }

  function handleGlobalRate(rating: 1 | 2 | 3) {
    const card = globalCards[globalIndex]
    const updated = rateCard(card, rating)
    // Save back to the note's deck
    const deck = loadDeck(card.noteId)
    const newDeck = deck.map(c => c.front === card.front && c.back === card.back ? updated : c)
    saveDeck(card.noteId, newDeck)
    if (globalIndex + 1 < globalCards.length) {
      setGlobalIndex(globalIndex + 1)
      setGlobalFlipped(false)
    } else {
      // Recalculate global due and return to setup
      const total = notes.reduce((acc, n) => acc + getDueCards(loadDeck(n.id)).length, 0)
      setTotalGlobalDue(total)
      setMode('setup')
    }
  }

  async function generate() {
    if (!selectedNoteId) return
    setLoading(true)
    setError('')
    try {
      const { cards: c } = await api.flashcards.generate(selectedNoteId, count)
      const newDeck = c.map((fc) => initCard(fc.front, fc.back))
      saveDeck(selectedNoteId, newDeck)
      setCards(c)
      setDeck(newDeck)
      setDueCards(newDeck)
      setIndex(0)
      setFlipped(false)
      setMode('browse')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function startReview() {
    const due = getDueCards(deck)
    if (due.length === 0) return
    setDueCards(due)
    setIndex(0)
    setFlipped(false)
    setMode('review')
  }

  function handleRate(rating: 1 | 2 | 3) {
    const card = dueCards[index]
    const updated = rateCard(card, rating)
    const newDeck = deck.map((c) => c.front === card.front ? updated : c)
    saveDeck(selectedNoteId, newDeck)
    setDeck(newDeck)
    if (index + 1 < dueCards.length) {
      setIndex(index + 1)
      setFlipped(false)
    } else {
      setDueCards(getDueCards(newDeck))
      setMode('setup')
    }
  }

  function next() { setIndex((i) => Math.min(i + 1, cards.length - 1)); setFlipped(false) }
  function prev() { setIndex((i) => Math.max(i - 1, 0)); setFlipped(false) }
  function reset() { setMode('setup'); setCards([]); setError('') }

  const dueCount = getDueCards(deck).length

  if (mode === 'global-review') {
    const card = globalCards[globalIndex]
    const sourceNote = notes.find(n => n.id === card.noteId)
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Review All Due</h2>
          <div className="flex gap-2">
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{globalIndex + 1} / {globalCards.length}</span>
            <button className="btn-ghost" onClick={() => setMode('setup')}><RotateCcw size={13} />Exit</button>
          </div>
        </div>
        {sourceNote && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <BookOpen size={11} />{sourceNote.title}
          </div>
        )}
        <div className="flashcard-face" onClick={() => setGlobalFlipped(!globalFlipped)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 16, fontWeight: 600 }}>{globalFlipped ? 'Answer' : 'Question'}</div>
          <div className="flashcard-text" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{globalFlipped ? card.back : card.front}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>{globalFlipped ? 'How well did you know this?' : 'Click to reveal answer'}</div>
        </div>
        {globalFlipped && (
          <div className="flex gap-2">
            <button onClick={() => handleGlobalRate(1)} style={{ flex: 1, justifyContent: 'center', background: 'rgba(184,64,64,0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 999, padding: '10px 0', fontWeight: 600, fontSize: 13 }}>Hard</button>
            <button onClick={() => handleGlobalRate(2)} style={{ flex: 1, justifyContent: 'center', background: 'rgba(184,160,64,0.1)', color: '#a07020', border: '1px solid #c8a040', borderRadius: 999, padding: '10px 0', fontWeight: 600, fontSize: 13 }}>OK</button>
            <button onClick={() => handleGlobalRate(3)} style={{ flex: 1, justifyContent: 'center', background: 'rgba(74,124,94,0.1)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 999, padding: '10px 0', fontWeight: 600, fontSize: 13 }}>Easy</button>
          </div>
        )}
      </div>
    )
  }

  if (mode === 'review') {
    const card = dueCards[index]
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Review</h2>
          <div className="flex gap-2">
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{index + 1} / {dueCards.length} due</span>
            <button className="btn-ghost" onClick={reset}><RotateCcw size={13} />Exit</button>
          </div>
        </div>
        <div className="flashcard-face" onClick={() => setFlipped(!flipped)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', marginBottom: 20, maxWidth: '100%' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 16, fontWeight: 600 }}>{flipped ? 'Answer' : 'Question'}</div>
          <div className="flashcard-text" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{flipped ? card.back : card.front}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>{flipped ? 'How well did you know this?' : 'Click to reveal answer'}</div>
        </div>
        {flipped && (
          <div className="flex gap-2" style={{ maxWidth: '100%' }}>
            <button onClick={() => handleRate(1)} style={{ flex: 1, justifyContent: 'center', background: 'rgba(184,64,64,0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 999, padding: '10px 0', fontWeight: 600, fontSize: 13 }}>Hard</button>
            <button onClick={() => handleRate(2)} style={{ flex: 1, justifyContent: 'center', background: 'rgba(184,160,64,0.1)', color: '#a07020', border: '1px solid #c8a040', borderRadius: 999, padding: '10px 0', fontWeight: 600, fontSize: 13 }}>OK</button>
            <button onClick={() => handleRate(3)} style={{ flex: 1, justifyContent: 'center', background: 'rgba(74,124,94,0.1)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 999, padding: '10px 0', fontWeight: 600, fontSize: 13 }}>Easy</button>
          </div>
        )}
      </div>
    )
  }

  if (mode === 'browse' && cards.length > 0) {
    const card = cards[index]
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Flashcards</h2>
          <div className="flex gap-2">
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{index + 1} / {cards.length}</span>
            <button className="btn-ghost" onClick={reset}><RotateCcw size={13} />New Set</button>
            {dueCount > 0 && <button className="btn-primary" onClick={startReview}><Brain size={13} />Review {dueCount} due</button>}
          </div>
        </div>
        <div className="flashcard-face" onClick={() => setFlipped(!flipped)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', marginBottom: 20, maxWidth: '100%' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 16, fontWeight: 600 }}>{flipped ? 'Answer' : 'Question'}</div>
          <div className="flashcard-text" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{flipped ? card.back : card.front}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>Click to {flipped ? 'see question' : 'reveal answer'}</div>
        </div>
        <div className="flex gap-2" style={{ maxWidth: '100%', marginBottom: 20 }}>
          <button className="btn-ghost" onClick={prev} disabled={index === 0} style={{ flex: 1 }}><ChevronLeft size={16} />Previous</button>
          <button className="btn-primary" onClick={next} disabled={index === cards.length - 1} style={{ flex: 1, justifyContent: 'center' }}>Next<ChevronRight size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '100%' }}>
          {cards.map((_, i) => (
            <div key={i} onClick={() => { setIndex(i); setFlipped(false) }} style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', background: i === index ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${i === index ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: i === index ? '#fff' : 'var(--text-muted)' }}>{i + 1}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header"><h2 className="page-title">Flashcards</h2></div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab${activeTab === 'generate' ? ' active' : ''}`} onClick={() => setActiveTab('generate')}><Zap size={12} style={{ marginRight: 6 }} />Generate Cards</button>
        <button className={`tab${activeTab === 'review-all' ? ' active' : ''}`} onClick={() => setActiveTab('review-all')}>
          <Brain size={12} style={{ marginRight: 6 }} />Spaced Review
        </button>
      </div>

      {activeTab === 'review-all' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Show cards from</label>
            <select value={reviewSubjectFilter} onChange={(e) => {
              setReviewSubjectFilter(e.target.value)
              localStorage.setItem('vaultarc-review-subject', e.target.value)
            }}>
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {totalGlobalDue === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <Brain size={24} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>All caught up!</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No cards due{reviewSubjectFilter ? ' in this subject' : ''} right now.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{totalGlobalDue} card{totalGlobalDue !== 1 ? 's' : ''} due</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Shuffled across {reviewSubjectFilter ? subjects.find(s => s.id === reviewSubjectFilter)?.name : 'all your notes'}</div>
              </div>
              <button className="btn-primary" onClick={startGlobalReview} style={{ flexShrink: 0 }}><Brain size={13} />Start Review</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'generate' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Note</label>
                <NoteSelect notes={notes} subjects={subjects} value={selectedNoteId} onChange={setSelectedNoteId} placeholder="Choose a note…" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Number of Cards</label>
                <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} cards</option>)}
                </select>
              </div>
              {selectedNoteId && notes.find(n => n.id === selectedNoteId)?.source_type === 'upload' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  💡 Tip: Flashcards work best on notes you wrote yourself. Uploaded PDFs may produce generic cards — consider writing summary notes from the PDF instead.
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn-primary" onClick={generate} disabled={loading || !selectedNoteId} style={{ flex: 1, justifyContent: 'center' }}>
                  {loading ? <><span className="spinner" />Generating…</> : <><Zap size={13} />Generate Cards</>}
                </button>
                {dueCount > 0 && (
                  <button className="btn-ghost" onClick={startReview}><Brain size={13} />Review {dueCount} due</button>
                )}
              </div>
            </div>
          </div>
          {deck.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {deck.length} cards saved · {dueCount} due for review
            </div>
          )}
          {notes.length === 0 && (
            <div className="empty-state" style={{ marginTop: 32 }}>
              <Layers size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
              <p>Create some notes first, then generate flashcards from them.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
