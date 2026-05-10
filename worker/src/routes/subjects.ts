import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'

export const subjects = new Hono<{ Bindings: Env }>()

// List all subjects with note count
subjects.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.color, s.exam, s.created_at,
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
  const { name, color = '#b87040', exam } = await c.req.json<{ name: string; color?: string; exam?: string }>()
  if (!name?.trim()) return c.json({ error: 'name required' }, 400)
  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare('INSERT INTO subjects (id, name, color, exam, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name.trim(), color, exam || null, now).run()
  return c.json({ id, name: name.trim(), color, exam: exam || null, created_at: now, note_count: 0 }, 201)
})

// Rename / recolor / re-exam subject
subjects.put('/:id', async (c) => {
  const { name, color, exam } = await c.req.json<{ name?: string; color?: string; exam?: string }>()
  await c.env.DB.prepare(
    'UPDATE subjects SET name = COALESCE(?, name), color = COALESCE(?, color), exam = ? WHERE id = ?'
  ).bind(name ?? null, color ?? null, exam !== undefined ? (exam || null) : null, c.req.param('id')).run()
  const row = await c.env.DB.prepare('SELECT * FROM subjects WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(row)
})

// Delete subject (notes become uncategorized)
subjects.delete('/:id', async (c) => {
  await c.env.DB.prepare('UPDATE notes SET subject_id = NULL WHERE subject_id = ?').bind(c.req.param('id')).run()
  await c.env.DB.prepare('DELETE FROM subjects WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})
