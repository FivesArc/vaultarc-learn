import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { Note, Question } from '../lib/api'
import { Zap, RotateCcw, Briefcase, BookOpen, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import NoteSelect from '../components/NoteSelect'

type Stage = 'setup' | 'taking' | 'result'
type Mode = 'standard' | 'scenario' | 'subject'

type HistoryEntry = {
  id: string
  mode: Mode
  title: string
  score: number
  total: number
  percent: number
  questions: Question[]
  answers: number[]
  taken_at: number
  note_id?: string
  subject_id?: string
  quiz_id?: string  // set for standard quizzes (DB-backed)
}

function stripPrefix(opt: string): string {
  // strip leading "A. " / "B. " etc if present
  return opt.replace(/^[A-Z]\.\s+/, '')
}

export default function QuizPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<import('../lib/api').Subject[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [count, setCount] = useState(5)
  const [mode, setMode] = useState<Mode>('standard')
  const [quiz, setQuiz] = useState<{ title: string; questions: Question[]; id?: string } | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [stage, setStage] = useState<Stage>('setup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')

  useEffect(() => {
    api.notes.list().then(setNotes)
    api.subjects.list().then(setSubjects)
  }, [])

  // Load DB history for standard quizzes when note changes
  useEffect(() => {
    if (selectedNoteId) loadDbHistory(selectedNoteId)
    else setHistory(prev => prev.filter(h => h.mode !== 'standard'))
  }, [selectedNoteId])

  async function loadDbHistory(noteId: string) {
    try {
      const quizzes = await api.quiz.listForNote(noteId)
      const allResults = await Promise.all(
        quizzes.map(async (q: any) => {
          const rs = await api.quiz.results(q.id) as any[]
          const questions: Question[] = q.questions ? (typeof q.questions === 'string' ? JSON.parse(q.questions) : q.questions) : []
          return rs.map(r => ({
            id: `db-${r.id || Math.random()}`,
            mode: 'standard' as Mode,
            title: q.title,
            score: r.score,
            total: r.total,
            percent: r.percent ?? Math.round((r.score / r.total) * 100),
            questions,
            answers: r.answers ? (typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers) : [],
            taken_at: r.taken_at,
            note_id: noteId,
            quiz_id: q.id,
          }))
        })
      )
      const dbEntries = allResults.flat().sort((a, b) => b.taken_at - a.taken_at).slice(0, 20)
      setHistory(prev => [...prev.filter(h => h.mode !== 'standard'), ...dbEntries])
    } catch { /* ignore */ }
  }

  async function generate() {
    setLoading(true); setError('')
    try {
      if (mode === 'subject') {
        if (!selectedSubjectId) return
        const q = await api.quiz.generateForSubject(selectedSubjectId, count)
        setQuiz({ title: q.title, questions: q.questions })
        setAnswers(new Array(q.questions.length).fill(null))
      } else if (mode === 'scenario') {
        if (!selectedNoteId) return
        const q = await api.scenario.generate(selectedNoteId, count)
        setQuiz({ title: q.title, questions: q.questions })
        setAnswers(new Array(q.questions.length).fill(null))
      } else {
        if (!selectedNoteId) return
        const q = await api.quiz.generate(selectedNoteId, count)
        setQuiz(q)
        setAnswers(new Array(q.questions.length).fill(null))
      }
      setStage('taking')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function submit() {
    if (!quiz || answers.includes(null)) return
    setLoading(true)
    try {
      const finalAnswers = answers as number[]
      let score: number, total: number, percent: number

      if (quiz.id && mode === 'standard') {
        const r = await api.quiz.submit(quiz.id, finalAnswers)
        score = r.score; total = r.total; percent = r.percent
      } else {
        score = finalAnswers.reduce((acc, ans, i) => acc + (ans === quiz.questions[i].correct ? 1 : 0), 0)
        total = quiz.questions.length
        percent = Math.round((score / total) * 100)
      }

      const entry: HistoryEntry = {
        id: `local-${Date.now()}`,
        mode,
        title: quiz.title,
        score, total, percent,
        questions: quiz.questions,
        answers: finalAnswers,
        taken_at: Date.now(),
        note_id: mode !== 'subject' ? selectedNoteId : undefined,
        subject_id: mode === 'subject' ? selectedSubjectId : undefined,
        quiz_id: quiz.id,
      }
      setHistory(prev => [entry, ...prev])
      setStage('result')
      if (selectedNoteId && mode === 'standard') loadDbHistory(selectedNoteId)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function deleteEntry(entry: HistoryEntry) {
    if (entry.quiz_id) {
      await api.quiz.delete(entry.quiz_id)
      // remove all history entries with same quiz_id
      setHistory(prev => prev.filter(h => h.quiz_id !== entry.quiz_id))
    } else {
      setHistory(prev => prev.filter(h => h.id !== entry.id))
    }
  }

  function reset() {
    setQuiz(null); setAnswers([]); setStage('setup'); setError('')
  }

  const currentResult = history[0]

  if (stage === 'result' && currentResult) return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Quiz Complete</h2>
        <button className="btn-ghost" onClick={reset}><RotateCcw size={13} />New Quiz</button>
      </div>

      <div className="score-card" style={{ marginBottom: 24, maxWidth: 400 }}>
        <div className="score">{currentResult.percent}%</div>
        <div className="label">{currentResult.score} / {currentResult.total} correct</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          {currentResult.percent === 100 ? '🎉 Perfect score!' : currentResult.percent >= 80 ? '👍 Great work!' : currentResult.percent >= 60 ? '📚 Keep studying!' : '🔄 Review your notes and try again.'}
        </div>
      </div>

      <div style={{ maxWidth: '100%' }}>
        {quiz?.questions.map((q, i) => {
          const userAns = currentResult.answers[i]
          const correct = q.correct
          return (
            <div key={i} className="quiz-question">
              <p>{i + 1}. {q.question}</p>
              <div className="quiz-options">
                {q.options.map((opt, j) => {
                  let cls = 'quiz-option'
                  if (j === correct) cls += ' correct'
                  else if (j === userAns && userAns !== correct) cls += ' wrong'
                  return <button key={j} className={cls} disabled>{String.fromCharCode(65 + j)}. {stripPrefix(opt)}</button>
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
      <div style={{ maxWidth: '100%' }}>
        {quiz.questions.map((q, i) => (
          <div key={i} className="quiz-question">
            <p>{i + 1}. {q.question}</p>
            <div className="quiz-options">
              {q.options.map((opt, j) => (
                <button key={j} className={`quiz-option${answers[i] === j ? ' selected' : ''}`}
                  onClick={() => { const a = [...answers]; a[i] = j; setAnswers(a) }}>
                  <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + j)}.</span> {stripPrefix(opt)}
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

  const modeLabels: Record<Mode, string> = { standard: 'Standard', scenario: 'Scenario', subject: 'Subject Mix' }

  const visibleHistory = history.filter(h => {
    if (h.mode !== mode) return false
    if (mode === 'subject') return h.subject_id === selectedSubjectId && !!selectedSubjectId
    return h.note_id === selectedNoteId && !!selectedNoteId
  })

  return (
    <div>
      <div className="page-header"><h2 className="page-title">Quiz Me</h2></div>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab${mode === 'standard' ? ' active' : ''}`} onClick={() => setMode('standard')}><Zap size={12} style={{ marginRight: 6 }} />Standard</button>
        <button className={`tab${mode === 'scenario' ? ' active' : ''}`} onClick={() => setMode('scenario')}><Briefcase size={12} style={{ marginRight: 6 }} />Scenario</button>
        <button className={`tab${mode === 'subject' ? ' active' : ''}`} onClick={() => setMode('subject')}><BookOpen size={12} style={{ marginRight: 6 }} />Subject Mix</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'subject' ? (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Subject</label>
              <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
                <option value="">Choose a subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.note_count} notes)</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Note</label>
              <NoteSelect notes={notes} subjects={subjects} value={selectedNoteId} onChange={setSelectedNoteId} placeholder="Choose a note…" />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Number of Questions</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {(mode === 'subject' ? [5, 10, 15, 20] : [3, 5, 10, 15, 20]).map((n) => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={generate}
            disabled={loading || (mode === 'subject' ? !selectedSubjectId : !selectedNoteId)}
            style={{ justifyContent: 'center' }}>
            {loading ? <><span className="spinner" />Generating…</> : <><Zap size={13} />Generate {mode === 'scenario' ? 'Scenarios' : mode === 'subject' ? 'Mixed Quiz' : 'Quiz'}</>}
          </button>
        </div>
      </div>

      {visibleHistory.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>History</div>
          <div className="history-list">
            {visibleHistory.map((entry) => (
              <div key={entry.id}>
                <div className="history-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                  <span style={{ flex: 1, fontSize: 12 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 6, background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3 }}>
                      {modeLabels[entry.mode]}
                    </span>
                    {entry.title}
                  </span>
                  <span className="history-score">{entry.score}/{entry.total} — {entry.percent}%</span>
                  {expandedEntry === entry.id ? <ChevronUp size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />}
                  <button onClick={(e) => { e.stopPropagation(); deleteEntry(entry) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                    title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
                {expandedEntry === entry.id && entry.questions.length > 0 && (
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 16px', marginTop: 4, marginBottom: 4 }}>
                    {entry.questions.map((q, i) => {
                      const userAns = entry.answers[i]
                      const correct = q.correct
                      const isCorrect = userAns === correct
                      return (
                        <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < entry.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{i + 1}. {q.question}</div>
                          <div style={{ fontSize: 12, color: isCorrect ? 'var(--success, #22c55e)' : 'var(--danger)', marginBottom: 2 }}>
                            Your answer: {String.fromCharCode(65 + userAns)}. {stripPrefix(q.options[userAns] ?? '')} {isCorrect ? '✓' : '✗'}
                          </div>
                          {!isCorrect && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Correct: {String.fromCharCode(65 + correct)}. {stripPrefix(q.options[correct] ?? '')}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
