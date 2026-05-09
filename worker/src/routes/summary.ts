import { Hono } from 'hono'
import { Env } from '../index'
import { runAI } from '../lib/ai'

export const summary = new Hono<{ Bindings: Env }>()

summary.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    if (!note_id) return c.json({ error: 'note_id required' }, 400)

    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id)
      .first<{ title: string; content: string }>()

    if (!note) return c.json({ error: 'Note not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'Note has no content' }, 400)

    const system = `You are a study assistant. Summarise the provided notes in a clear, concise way using bullet points. Focus on key concepts and important facts. Keep it brief but comprehensive.`

    const text = await runAI(c.env.AI, system, `Summarise these notes titled "${note.title}":\n\n${note.content}`)
    return c.json({ summary: text })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
