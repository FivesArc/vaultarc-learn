import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

export const teachback = new Hono<{ Bindings: Env }>()

// Get a question to explain
teachback.post('/question', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)

    const { text } = truncateForAI(note.content)
    const raw = await runAI(c.env.AI,
      `You are a study coach using the Feynman technique to build deep understanding.
Pick the single concept from these notes that is most important AND most commonly misunderstood.
Ask the student to explain it as if they are teaching it to someone who has never encountered the topic.
The question should force them to explain the WHY and HOW, not just the WHAT.
Keep it one clear sentence. Output ONLY the question, no preamble, no intro.`,
      `Notes titled "${note.title}":\n\n${text}`
    )
    return c.json({ question: raw.trim() })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})

// Evaluate the student's explanation
teachback.post('/evaluate', async (c) => {
  try {
    const { note_id, question, answer } = await c.req.json<{ note_id: string; question: string; answer: string }>()
    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)

    const { text } = truncateForAI(note.content)
    const raw = await runAI(c.env.AI,
      `You are an expert study coach evaluating understanding using the Feynman technique.
Your job is to identify whether the student truly understands the concept or is just repeating words.

Scoring:
- "strong": they explained the WHY and HOW correctly, not just the WHAT. They could teach it.
- "partial": they have the right idea but missed something important, or explained WHAT without WHY
- "needs_work": they are confused, used the right words incorrectly, or mostly missed the point

For "got_right": be specific about what they actually understood — quote or paraphrase their answer
For "missed": be honest and specific — what gap in understanding does their answer reveal?
For "remember": write one sentence that captures the core concept in a way that will stick — use an analogy if it helps

Output ONLY valid JSON, no markdown:
{
  "score": "strong" | "partial" | "needs_work",
  "got_right": "...",
  "missed": "... (empty string if nothing missed)",
  "remember": "..."
}`,
      `Note content:\n${text}\n\nQuestion asked: ${question}\n\nStudent's answer: ${answer}`
    )

    try {
      const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      const result = match ? JSON.parse(match[0]) : { score: 'partial', got_right: '', missed: '', remember: '' }
      return c.json(result)
    } catch {
      return c.json({ score: 'partial', got_right: raw, missed: '', remember: '' })
    }
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
