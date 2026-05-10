import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'
import { nanoid } from '../lib/id'

type Question = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

function parseQuestions(raw: string): Question[] {
  // Strip markdown code fences
  let cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  // Extract JSON array
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (match) cleaned = match[0]
  return JSON.parse(cleaned)
}

export const quiz = new Hono<{ Bindings: Env }>()

quiz.post('/generate', async (c) => {
  try {
    const { note_id, count = 5 } = await c.req.json<{ note_id: string; count?: number }>()
    if (!note_id) return c.json({ error: 'note_id required' }, 400)

    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id)
      .first<{ title: string; content: string }>()

    if (!note) return c.json({ error: 'Note not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'Note has no content to generate a quiz from' }, 400)

    const system = `You are an expert at writing quiz questions that test real understanding, not just memorisation.

Rules for every question:
- Test comprehension and application — ask "why does X happen", "what would you do if", "what is the difference between" — not just "what is the definition of"
- Wrong answers (distractors) must be plausible — common misconceptions, related concepts, or things that sound right but aren't. Never use obviously wrong answers.
- The explanation must teach: explain WHY the correct answer is right AND why the most tempting wrong answer is wrong
- Mix question types: some definitions, some cause-effect, some comparisons, some "what happens if"
- Questions should cover the most important concepts from the notes, not trivia

Generate ${count} multiple choice questions. Each must have exactly 4 options.
Output ONLY a raw JSON array, no markdown, no code fences.
Format: [{"question":"...","options":["option1","option2","option3","option4"],"correct":0,"explanation":"..."}]
"correct" is the 0-based index of the correct answer.`

    const { text: noteText } = truncateForAI(note.content)
    const raw = await runAI(c.env.AI, system, noteText)

    let questions: Question[]
    try {
      questions = parseQuestions(raw)
    } catch {
      return c.json({ error: `Failed to parse quiz. AI returned: ${raw.slice(0, 200)}` }, 500)
    }

    const id = nanoid()
    const now = Date.now()
    await c.env.DB.prepare(
      'INSERT INTO quizzes (id, note_id, title, questions, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, note_id, `Quiz: ${note.title}`, JSON.stringify(questions), now)
      .run()

    return c.json({ id, note_id, title: `Quiz: ${note.title}`, questions, created_at: now }, 201)
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})

quiz.get('/note/:note_id', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, questions, created_at FROM quizzes WHERE note_id = ? ORDER BY created_at DESC',
  )
    .bind(c.req.param('note_id'))
    .all()
  return c.json(results)
})

quiz.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; questions: string }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json({ ...row, questions: JSON.parse(row.questions) })
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

quiz.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM quiz_results WHERE quiz_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

quiz.get('/:id/results', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM quiz_results WHERE quiz_id = ? ORDER BY taken_at DESC',
  )
    .bind(c.req.param('id'))
    .all()
  return c.json(results)
})

// Cross-note subject quiz — pulls from multiple notes in a subject
quiz.post('/subject', async (c) => {
  try {
    const { subject_id, count = 10 } = await c.req.json<{ subject_id: string; count?: number }>()
    if (!subject_id) return c.json({ error: 'subject_id required' }, 400)

    const subject = await c.env.DB.prepare('SELECT name FROM subjects WHERE id = ?')
      .bind(subject_id).first<{ name: string }>()
    if (!subject) return c.json({ error: 'Subject not found' }, 404)

    // Fetch up to 5 notes from this subject that have content
    const { results: notes } = await c.env.DB.prepare(
      "SELECT id, title, content FROM notes WHERE subject_id = ? AND content != '' ORDER BY RANDOM() LIMIT 5"
    ).bind(subject_id).all<{ id: string; title: string; content: string }>()

    if (notes.length === 0) return c.json({ error: 'No notes with content found in this subject' }, 400)

    // Build combined context — sample from each note
    const combined = notes.map((n) => {
      const { text } = truncateForAI(n.content)
      const snippet = text.slice(0, Math.floor(12000 / notes.length))
      return `## ${n.title}\n${snippet}`
    }).join('\n\n---\n\n')

    const raw = await runAI(c.env.AI,
      `You are an expert at writing quiz questions that test real understanding across multiple topics.
The student is studying the subject "${subject.name}" which covers ${notes.length} different note(s).
Generate questions that span across these topics — mix easy and hard, vary the concept areas covered.

Rules:
- Test comprehension and application — "why does X happen", "what is the difference between", "what would you do if"
- Wrong answers must be plausible — common misconceptions, not obviously wrong
- The explanation must teach: WHY the correct answer is right AND why the most tempting wrong answer is wrong
- Spread questions across the different topic areas — do not focus only on one note
- Each must have exactly 4 options

Output ONLY a raw JSON array, no markdown, no code fences.
Format: [{"question":"...","options":["option1","option2","option3","option4"],"correct":0,"explanation":"...","source":"topic area in 3-5 words"}]
"correct" is the 0-based index of the correct answer. "source" is which topic area the question covers.`,
      `Generate ${count} mixed quiz questions from these study notes:\n\n${combined}`
    )

    let questions: Question[]
    try { questions = parseQuestions(raw) }
    catch { return c.json({ error: `Failed to parse questions. AI returned: ${raw.slice(0, 200)}` }, 500) }

    return c.json({ subject_id, subject_name: subject.name, title: `${subject.name} — Mixed Quiz`, questions })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
