import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'

export const notes = new Hono<{ Bindings: Env }>()

notes.get('/', async (c) => {
  const q = c.req.query('q')
  const tag = c.req.query('tag')
  let query = 'SELECT id, title, source_type, tags, created_at, updated_at FROM notes'
  const params: string[] = []

  if (q && tag) {
    query += ' WHERE (title LIKE ? OR content LIKE ?) AND tags LIKE ?'
    params.push(`%${q}%`, `%${q}%`, `%${tag}%`)
  } else if (q) {
    query += ' WHERE title LIKE ? OR content LIKE ?'
    params.push(`%${q}%`, `%${q}%`)
  } else if (tag) {
    query += ' WHERE tags LIKE ?'
    params.push(`%${tag}%`)
  }

  query += ' ORDER BY updated_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

notes.get('/tags', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT DISTINCT tags FROM notes WHERE tags != ''").all()
  const allTags = results
    .flatMap((r: any) => r.tags.split(','))
    .map((t: string) => t.trim())
    .filter(Boolean)
  return c.json([...new Set(allTags)])
})

notes.get('/:id', async (c) => {
  const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(c.req.param('id'))
    .first()
  if (!note) return c.json({ error: 'Not found' }, 404)
  return c.json(note)
})

notes.post('/', async (c) => {
  const { title, content, tags = '' } = await c.req.json<{ title: string; content: string; tags?: string }>()
  if (!title) return c.json({ error: 'title required' }, 400)

  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO notes (id, title, content, source_type, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, title, content || '', 'text', tags, now, now)
    .run()

  return c.json({ id, title, content, source_type: 'text', tags, created_at: now, updated_at: now }, 201)
})

notes.put('/:id', async (c) => {
  const { title, content, tags } = await c.req.json<{ title?: string; content?: string; tags?: string }>()
  const now = Date.now()
  await c.env.DB.prepare(
    'UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), tags = COALESCE(?, tags), updated_at = ? WHERE id = ?',
  )
    .bind(title ?? null, content ?? null, tags ?? null, now, c.req.param('id'))
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
