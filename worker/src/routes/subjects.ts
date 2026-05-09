import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'

export const subjects = new Hono<{ Bindings: Env }>()

// List all subjects with note count
subjects.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.color, s.created_at,
           COUNT(n.id) as note_count
    FROM subjects s
    LEFT JOIN notes n ON n.subject_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at ASC
  `).all()
  return c.json(results)
})

// Create subject
subjects.post('/', async (c) => {
  const { name, color = '#b87040' } = await c.req.json<{ name: string; color?: string }>()
  if (!name?.trim()) return c.json({ error: 'name required' }, 400)
  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare('INSERT INTO subjects (id, name, color, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, name.trim(), color, now).run()
  return c.json({ id, name: name.trim(), color, created_at: now, note_count: 0 }, 201)
})

// Rename / recolor subject
subjects.put('/:id', async (c) => {
  const { name, color } = await c.req.json<{ name?: string; color?: string }>()
  await c.env.DB.prepare(
    'UPDATE subjects SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?'
  ).bind(name ?? null, color ?? null, c.req.param('id')).run()
  const row = await c.env.DB.prepare('SELECT * FROM subjects WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(row)
})

// Delete subject (notes become uncategorized)
subjects.delete('/:id', async (c) => {
  await c.env.DB.prepare('UPDATE notes SET subject_id = NULL WHERE subject_id = ?').bind(c.req.param('id')).run()
  await c.env.DB.prepare('DELETE FROM subjects WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})
