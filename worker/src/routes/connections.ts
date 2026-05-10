import { Hono } from 'hono'
import { Env } from '../index'
import { embed } from '../lib/ai'

export const connections = new Hono<{ Bindings: Env }>()

connections.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT id, title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ id: string; title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)

    const vector = await embed(c.env.AI, `${note.title}\n\n${(note.content || '').slice(0, 2000)}`)
    const results = await c.env.VECTORIZE.query(vector, { topK: 5, returnMetadata: 'all' })

    const ids = (results.matches ?? [])
      .filter((m) => m.id !== note_id && m.score > 0.7)
      .slice(0, 4)
      .map((m) => m.id)

    if (ids.length === 0) return c.json({ connections: [] })

    const placeholders = ids.map(() => '?').join(',')
    const { results: notes } = await c.env.DB.prepare(
      `SELECT id, title FROM notes WHERE id IN (${placeholders})`
    ).bind(...ids).all()

    return c.json({ connections: notes })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
