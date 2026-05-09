import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note, Quiz, QuizResult } from '../lib/api'
import { Zap, RotateCcw, History } from 'lucide-react'

type Stage = 'setup' | 'taking' | 'result'

export default function QuizPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [count, setCount] = useState(5)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [result, setResult] = useState<QuizResult | null>(null)
  const [stage, setStage] = useState<Stage>('setup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<QuizResult[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { api.notes.list().then(setNotes) }, [])

  async function generate() {
    if (!selectedNoteId) return
    setLoading(true)
    setError('')
    try {
      const q = await api.quiz.generate(selectedNoteId, count)
      setQuiz(q)
      setAnswers(new Array(q.questions.length).fill(null))
      setResult(null)
      setStage('taking')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function submit() {
    if (!quiz || answers.includes(null)) return
    setLoading(true)
    try {
      const r = await api.quiz.submit(quiz.id, answers as number[])
      setResult(r)
      setStage('result')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function loadHistory() {
    if (!selectedNoteId) return
    const quizzes = await api.quiz.listForNote(selectedNoteId)
    const allResults = await Promise.all(quizzes.map((q) => api.quiz.results(q.id)))
    setHistory(allResults.flat().sort((a: any, b: any) => b.taken_at - a.taken_at).slice(0, 10))
    setShowHistory(true)
  }

  function reset() {
    setQuiz(null)
    setAnswers([])
    setResult(null)
    setStage('setup')
    setError('')
    setShowHistory(false)
  }

  if (stage === 'result' && result) return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Quiz Complete</h2>
        <button className="btn-ghost" onClick={reset}><RotateCcw size={13} />New Quiz</button>
      </div>
      <div className="score-card" style={{ marginBottom: 24, maxWidth: 400 }}>
        <div className="score">{result.percent}%</div>
        <div className="label">{result.score} / {result.total} correct</div>
      </div>
      <div style={{ maxWidth: 640 }}>
        {quiz?.questions.map((q, i) => {
          const userAns = (answers as number[])[i]
          const correct = q.correct
          return (
            <div key={i} className="quiz-question">
              <p>{i + 1}. {q.question}</p>
              <div className="quiz-options">
                {q.options.map((opt, j) => {
                  let cls = 'quiz-option'
                  if (j === correct) cls += ' correct'
                  else if (j === userAns && userAns !== correct) cls += ' wrong'
                  return <button key={j} className={cls} disabled>{String.fromCharCode(65 + j)}. {opt}</button>
                })}
              </div>
              {userAns !== correct && <div className="explanation"><strong>Explanation:</strong> {q.explanation}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (stage === 'taking' && quiz) return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{quiz.title}</h2>
        <button className="btn-ghost" onClick={reset}>← Back</button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <div style={{ maxWidth: 640 }}>
        {quiz.questions.map((q, i) => (
          <div key={i} className="quiz-question">
            <p>{i + 1}. {q.question}</p>
            <div className="quiz-options">
              {q.options.map((opt, j) => (
                <button
                  key={j}
                  className={`quiz-option${answers[i] === j ? ' selected' : ''}`}
                  onClick={() => { const a = [...answers]; a[i] = j; setAnswers(a) }}
                >
                  <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + j)}.</span> {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn-primary" onClick={submit} disabled={loading || answers.includes(null)}>
          {loading ? <span className="spinner" /> : 'Submit Quiz'}
        </button>
        {answers.includes(null) && <div className="text-muted mt-2">Answer all questions to submit.</div>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header"><h2 className="page-title">Generate Quiz</h2></div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Note</label>
            <select value={selectedNoteId} onChange={(e) => { setSelectedNoteId(e.target.value); setShowHistory(false) }}>
              <option value="">Choose a note…</option>
              {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Number of Questions</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={generate} disabled={loading || !selectedNoteId} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <><span className="spinner" />Generating…</> : <><Zap size={13} />Generate Quiz</>}
            </button>
            {selectedNoteId && (
              <button className="btn-ghost" onClick={loadHistory} title="View past results">
                <History size={13} />History
              </button>
            )}
          </div>
        </div>
      </div>

      {showHistory && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Past Results</div>
          {history.length === 0 ? (
            <div className="text-muted">No quiz history yet for this note.</div>
          ) : (
            <div className="history-list">
              {history.map((r: any, i) => (
                <div key={i} className="history-item">
                  <span>{new Date(r.taken_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="history-score">{r.score}/{r.total} — {r.percent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
