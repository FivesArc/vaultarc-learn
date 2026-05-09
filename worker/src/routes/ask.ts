import { Hono } from 'hono'
import { Env } from '../index'
import { runAI } from '../lib/ai'

export const ask = new Hono<{ Bindings: Env }>()

ask.post('/', async (c) => {
  try {
    const { note_id, question } = await c.req.json<{ note_id: string; question: string }>()
    if (!note_id || !question) return c.json({ error: 'note_id and question required' }, 400)

    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id)
      .first<{ title: string; content: string }>()

    if (!note) return c.json({ error: 'Note not found' }, 404)

    const system = `You are a helpful study assistant. The user is studying notes titled "${note.title}". Answer questions based on the note content. If the answer isn't in the notes, say so.

NOTE CONTENT:
${note.content || '(empty note — no content yet)'}`

    const answer = await runAI(c.env.AI, system, question)
    return c.json({ question, answer })
  } catch (e: any) {
    console.error('Ask error:', e)
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
