import { Hono } from 'hono'
import { Env } from '../index'
import { callClaude } from '../lib/claude'
import { nanoid } from '../lib/id'

type Question = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export const quiz = new Hono<{ Bindings: Env }>()

quiz.post('/generate', async (c) => {
  const { note_id, count = 5 } = await c.req.json<{ note_id: string; count?: number }>()
  if (!note_id) return c.json({ error: 'note_id required' }, 400)

  const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
    .bind(note_id)
    .first<{ title: string; content: string }>()

  if (!note) return c.json({ error: 'Note not found' }, 404)

  const system = `You are a quiz generator. Generate exactly ${count} multiple choice questions based on the provided notes. Return ONLY valid JSON — no markdown, no explanation.

Format:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "explanation": "..."
  }
]

"correct" is the 0-based index of the correct option.`

  const raw = await callClaude(c.env.ANTHROPIC_API_KEY, system, note.content)

  let questions: Question[]
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    questions = JSON.parse(match ? match[0] : raw)
  } catch {
    return c.json({ error: 'Failed to parse quiz questions' }, 500)
  }

  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO quizzes (id, note_id, title, questions, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, note_id, `Quiz: ${note.title}`, JSON.stringify(questions), now)
    .run()

  return c.json({ id, note_id, title: `Quiz: ${note.title}`, questions, created_at: now }, 201)
})

quiz.get('/note/:note_id', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, created_at FROM quizzes WHERE note_id = ? ORDER BY created_at DESC',
  )
    .bind(c.req.param('note_id'))
    .all()
  return c.json(results)
})

quiz.get('/:id', async (c) => {
  const quiz = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; questions: string }>()
  if (!quiz) return c.json({ error: 'Not found' }, 404)
  return c.json({ ...quiz, questions: JSON.parse(quiz.questions) })
})

quiz.post('/:id/submit', async (c) => {
  const { answers } = await c.req.json<{ answers: number[] }>()
  if (!answers) return c.json({ error: 'answers required' }, 400)

  const quizRow = await c.env.DB.prepare('SELECT questions FROM quizzes WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ questions: string }>()

  if (!quizRow) return c.json({ error: 'Quiz not found' }, 404)

  const questions: Question[] = JSON.parse(quizRow.questions)
  const score = answers.reduce((acc, ans, i) => acc + (ans === questions[i]?.correct ? 1 : 0), 0)

  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO quiz_results (id, quiz_id, score, total, answers, taken_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, c.req.param('id'), score, questions.length, JSON.stringify(answers), now)
    .run()

  return c.json({ id, score, total: questions.length, percent: Math.round((score / questions.length) * 100) })
})

quiz.get('/:id/results', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM quiz_results WHERE quiz_id = ? ORDER BY taken_at DESC',
  )
    .bind(c.req.param('id'))
    .all()
  return c.json(results)
})
