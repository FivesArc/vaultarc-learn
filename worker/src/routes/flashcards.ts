import { Hono } from 'hono'
import { Env } from '../index'
import { runAI } from '../lib/ai'

export type Flashcard = { front: string; back: string }

export const flashcards = new Hono<{ Bindings: Env }>()

flashcards.post('/generate', async (c) => {
  try {
    const { note_id, count = 10 } = await c.req.json<{ note_id: string; count?: number }>()
    if (!note_id) return c.json({ error: 'note_id required' }, 400)

    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id)
      .first<{ title: string; content: string }>()

    if (!note) return c.json({ error: 'Note not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'Note has no content' }, 400)

    const system = `You are a flashcard generator. Output ONLY a raw JSON array, no markdown, no code fences.

Generate ${count} flashcards from the notes. Each card has a front (question/term) and back (answer/definition).

Output format (raw JSON array only):
[{"front":"...","back":"..."}]`

    const raw = await runAI(c.env.AI, system, note.content)

    let cards: Flashcard[]
    try {
      let cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = cleaned.match(/\[[\s\S]*\]/)
      cards = JSON.parse(match ? match[0] : cleaned)
    } catch {
      return c.json({ error: `Failed to parse flashcards. AI returned: ${raw.slice(0, 200)}` }, 500)
    }

    return c.json({ note_id, cards })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
