import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note, Quiz, QuizResult } from '../lib/api'
import { Zap, RotateCcw } from 'lucide-react'

type Stage = 'setup' | 'taking' | 'result'

export default function QuizPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [count, setCount] = useState(5)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [_submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [stage, setStage] = useState<Stage>('setup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.notes.list().then(setNotes) }, [])

  async function generate() {
    if (!selectedNoteId) return
    setLoading(true)
    setError('')
    try {
      const q = await api.quiz.generate(selectedNoteId, count)
      setQuiz(q)
      setAnswers(new Array(q.questions.length).fill(null))
      setSubmitted(false)
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
      setSubmitted(true)
      setStage('result')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function reset() {
    setQuiz(null)
    setAnswers([])
    setSubmitted(false)
    setResult(null)
    setStage('setup')
    setError('')
  }

  if (stage === 'result' && result) return (
    <div>
      <div className="page-header">
        <h2>Quiz Complete</h2>
        <button className="btn-ghost" onClick={reset}><RotateCcw size={14} style={{ marginRight: 6 }} />New Quiz</button>
      </div>
      <div className="score-card" style={{ marginBottom: 24 }}>
        <div className="score">{result.percent}%</div>
        <div className="label">{result.score} / {result.total} correct</div>
      </div>
      <div>
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
                  return <button key={j} className={cls} disabled>{opt}</button>
                })}
              </div>
              {userAns !== correct && (
                <div className="explanation">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (stage === 'taking' && quiz) return (
    <div>
      <div className="page-header">
        <h2>{quiz.title}</h2>
        <button className="btn-ghost" onClick={reset}>← Back</button>
      </div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
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
                <span style={{ fontWeight: 700, marginRight: 6 }}>{String.fromCharCode(65 + j)}.</span> {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="btn-primary"
        onClick={submit}
        disabled={loading || answers.includes(null)}
        style={{ marginTop: 8 }}
      >
        {loading ? <span className="spinner" /> : 'Submit Quiz'}
      </button>
      {answers.includes(null) && <div className="text-muted mt-2">Answer all questions to submit.</div>}
    </div>
  )

  return (
    <div>
      <div className="page-header"><h2>Generate Quiz</h2></div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Note</label>
            <select value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
              <option value="">Choose a note...</option>
              {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Number of Questions</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={generate} disabled={loading || !selectedNoteId}>
            {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Generating...</> : <><Zap size={14} style={{ marginRight: 6 }} />Generate Quiz</>}
          </button>
        </div>
      </div>
    </div>
  )
}
