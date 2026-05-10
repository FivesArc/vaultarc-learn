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
      `You are an expert at writing scenario-based questions that force the student to apply knowledge in realistic situations — not recite facts.

Rules:
- Every question must describe a specific, realistic situation first — a problem to solve, an incident to respond to, a decision to make
- The correct answer requires understanding WHY, not just WHAT
- Wrong answers must represent real mistakes people make — the "almost right" choice, the "I'd do that first" trap, the misapplied concept
- The explanation must teach the reasoning: why the correct answer fits this situation, and what is wrong with the most tempting distractor
- Contexts: troubleshooting, incident response, design decisions, policy choices, explaining to a stakeholder — whatever fits the topic
- Vary the difficulty: some straightforward applications, some that require connecting two concepts

Output ONLY a raw JSON array, no markdown, no code fences, no explanation.
Format: [{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"..."}]
"correct" is the 0-based index of the correct answer.`,
      `Generate ${count} scenario-based questions from these notes. Each must present a realistic situation requiring applied thinking:\n\n${text}`
    )

    let questions: Question[]
    try { questions = parseQuestions(raw) }
    catch { return c.json({ error: `Failed to parse questions. AI returned: ${raw.slice(0, 200)}` }, 500) }

    return c.json({ note_id, title: `Scenario: ${note.title}`, questions })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
