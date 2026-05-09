import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'

export const notes = new Hono<{ Bindings: Env }>()

notes.get('/', async (c) => {
  const q = c.req.query('q')
  if (q) {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, source_type, created_at, updated_at FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC",
    ).bind(`%${q}%`, `%${q}%`).all()
    return c.json(results)
  }
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, source_type, created_at, updated_at FROM notes ORDER BY updated_at DESC',
  ).all()
  return c.json(results)
})

notes.get('/:id', async (c) => {
  const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(c.req.param('id'))
    .first()
  if (!note) return c.json({ error: 'Not found' }, 404)
  return c.json(note)
})

notes.post('/', async (c) => {
  const { title, content } = await c.req.json<{ title: string; content: string }>()
  if (!title || !content) return c.json({ error: 'title and content required' }, 400)

  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO notes (id, title, content, source_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, title, content, 'text', now, now)
    .run()

  return c.json({ id, title, content, source_type: 'text', created_at: now, updated_at: now }, 201)
})

notes.put('/:id', async (c) => {
  const { title, content } = await c.req.json<{ title?: string; content?: string }>()
  const now = Date.now()
  await c.env.DB.prepare(
    'UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), updated_at = ? WHERE id = ?',
  )
    .bind(title ?? null, content ?? null, now, c.req.param('id'))
    .run()

  const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(c.req.param('id'))
    .first()
  return c.json(note)
})

notes.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})
