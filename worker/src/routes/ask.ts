import { Hono } from 'hono'
import { Env } from '../index'
import { callClaude } from '../lib/claude'

export const ask = new Hono<{ Bindings: Env }>()

ask.post('/', async (c) => {
  const { note_id, question } = await c.req.json<{ note_id: string; question: string }>()
  if (!note_id || !question) return c.json({ error: 'note_id and question required' }, 400)

  const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
    .bind(note_id)
    .first<{ title: string; content: string }>()

  if (!note) return c.json({ error: 'Note not found' }, 404)

  const system = `You are a helpful study assistant. The user is studying the following notes titled "${note.title}". Answer questions clearly and concisely based on the note content. If the answer isn't in the notes, say so.

NOTE CONTENT:
${note.content}`

  const answer = await callClaude(c.env.ANTHROPIC_API_KEY, system, question)
  return c.json({ question, answer })
})
