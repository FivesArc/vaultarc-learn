import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note, Flashcard } from '../lib/api'
import { Layers, ChevronLeft, ChevronRight, RotateCcw, Zap } from 'lucide-react'

export default function FlashcardsPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [count, setCount] = useState(10)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'setup' | 'study'>('setup')

  useEffect(() => { api.notes.list().then(setNotes) }, [])

  async function generate() {
    if (!selectedNoteId) return
    setLoading(true)
    setError('')
    try {
      const { cards: c } = await api.flashcards.generate(selectedNoteId, count)
      setCards(c)
      setIndex(0)
      setFlipped(false)
      setStage('study')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function next() { setIndex((i) => Math.min(i + 1, cards.length - 1)); setFlipped(false) }
  function prev() { setIndex((i) => Math.max(i - 1, 0)); setFlipped(false) }
  function reset() { setStage('setup'); setCards([]); setError('') }

  if (stage === 'study' && cards.length > 0) {
    const card = cards[index]
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Flashcards</h2>
          <div className="flex gap-2">
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{index + 1} / {cards.length}</span>
            <button className="btn-ghost" onClick={reset}><RotateCcw size={13} />New Set</button>
          </div>
        </div>

        <div
          onClick={() => setFlipped(!flipped)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '60px 40px',
            textAlign: 'center',
            cursor: 'pointer',
            minHeight: 240,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.15s',
            marginBottom: 20,
            maxWidth: 640,
          }}
        >
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 16, fontWeight: 600 }}>
            {flipped ? 'Answer' : 'Question'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>
            {flipped ? card.back : card.front}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
            {flipped ? 'Click to see question' : 'Click to reveal answer'}
          </div>
        </div>

        <div className="flex gap-2" style={{ maxWidth: 640 }}>
          <button className="btn-ghost" onClick={prev} disabled={index === 0} style={{ flex: 1 }}>
            <ChevronLeft size={16} />Previous
          </button>
          <button className="btn-primary" onClick={next} disabled={index === cards.length - 1} style={{ flex: 1, justifyContent: 'center' }}>
            Next<ChevronRight size={16} />
          </button>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 640 }}>
          {cards.map((_, i) => (
            <div
              key={i}
              onClick={() => { setIndex(i); setFlipped(false) }}
              style={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                background: i === index ? 'var(--accent)' : 'var(--surface2)',
                border: `1px solid ${i === index ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                color: i === index ? '#fff' : 'var(--text-muted)',
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header"><h2 className="page-title">Flashcards</h2></div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <div className="card" style={{ maxWidth: 480 }}>
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
          <button className="btn-primary" onClick={generate} disabled={loading || !selectedNoteId}>
            {loading ? <><span className="spinner" style={{ marginRight: 6 }} />Generating…</> : <><Zap size={13} />Generate Flashcards</>}
          </button>
        </div>
      </div>

      {notes.length === 0 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <Layers size={36} style={{ margin: '0 auto', opacity: 0.4 }} />
          <p>Create some notes first, then generate flashcards from them.</p>
        </div>
      )}
    </div>
  )
}
