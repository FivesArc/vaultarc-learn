import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note, Flashcard } from '../lib/api'
import { loadDeck, saveDeck, getDueCards, initCard, rateCard } from '../lib/srs'
import type { CardState } from '../lib/srs'
import { Layers, ChevronLeft, ChevronRight, RotateCcw, Zap, Brain } from 'lucide-react'

type Mode = 'setup' | 'browse' | 'review'

export default function FlashcardsPage() {
  const [notes, setNotes] = useState<Note[]>([])
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

  useEffect(() => { api.notes.list().then(setNotes) }, [])

  useEffect(() => {
    if (selectedNoteId) {
      const d = loadDeck(selectedNoteId)
      setDeck(d)
      setDueCards(getDueCards(d))
    }
  }, [selectedNoteId])

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
        <div onClick={() => setFlipped(!flipped)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', marginBottom: 20, maxWidth: '100%' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 16, fontWeight: 600 }}>{flipped ? 'Answer' : 'Question'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{flipped ? card.back : card.front}</div>
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
        <div onClick={() => setFlipped(!flipped)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', marginBottom: 20, maxWidth: '100%' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 16, fontWeight: 600 }}>{flipped ? 'Answer' : 'Question'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{flipped ? card.back : card.front}</div>
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
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Note</label>
            <select value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
              <option value="">Choose a note…</option>
              {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Number of Cards</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} cards</option>)}
            </select>
          </div>
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
    </div>
  )
}
