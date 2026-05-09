import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

export const eli5 = new Hono<{ Bindings: Env }>()

eli5.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'No content' }, 400)

    const { text } = truncateForAI(note.content)
    const explanation = await runAI(c.env.AI,
      `You are a friendly, enthusiastic teacher explaining things to someone who struggles with traditional studying.
Rules:
- Use simple everyday language. No jargon without an instant plain-English explanation.
- Use real-world analogies from everyday life (food, sports, shopping, driving — things everyone knows).
- Keep sentences short. Use bullet points and bold key words.
- Make it memorable with a story or analogy where possible.
- End with a one-sentence "The bottom line is..." summary.`,
      `Explain the key concepts from these notes as simply as possible, with real-world analogies:\n\n${text}`
    )
    return c.json({ explanation })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
