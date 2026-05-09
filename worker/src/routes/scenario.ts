import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

type Question = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

function parseQuestions(raw: string): Question[] {
  let cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (match) cleaned = match[0]
  return JSON.parse(cleaned)
}

export const scenario = new Hono<{ Bindings: Env }>()

scenario.post('/generate', async (c) => {
  try {
    const { note_id, count = 5 } = await c.req.json<{ note_id: string; count?: number }>()
    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'No content' }, 400)

    const { text } = truncateForAI(note.content)
    const raw = await runAI(c.env.AI,
      `You are a scenario-based exam question generator for professional certifications.
Generate realistic situational questions where the person must APPLY knowledge, not just recall definitions.
Questions must start with realistic contexts like "You are a security analyst and...", "A client reports that...", "During a routine audit you discover...", "Your manager asks you to...".
Each scenario should describe a problem or situation requiring the student to choose the right action.
Output ONLY a raw JSON array, no markdown, no code fences, no explanation.
Format: [{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"..."}]
"correct" is the 0-based index of the correct answer.`,
      `Generate ${count} scenario-based multiple choice questions from these notes. Each must present a realistic workplace or exam situation:\n\n${text}`
    )

    let questions: Question[]
    try { questions = parseQuestions(raw) }
    catch { return c.json({ error: `Failed to parse questions. AI returned: ${raw.slice(0, 200)}` }, 500) }

    return c.json({ note_id, title: `Scenario: ${note.title}`, questions })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
