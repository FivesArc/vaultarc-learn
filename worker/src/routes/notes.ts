import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'
import { embed } from '../lib/ai'

export const notes = new Hono<{ Bindings: Env }>()

notes.get('/', async (c) => {
  const q = c.req.query('q')
  const tag = c.req.query('tag')
  const subject_id = c.req.query('subject_id')
  let query = 'SELECT id, title, source_type, tags, subject_id, section, position, created_at, updated_at FROM notes'
  const params: string[] = []
  const conditions: string[] = []

  if (q) conditions.push('(title LIKE ? OR content LIKE ?)')
  if (tag) conditions.push('tags LIKE ?')
  if (subject_id === 'none') conditions.push('subject_id IS NULL')
  else if (subject_id) conditions.push('subject_id = ?')

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')

  if (q) params.push(`%${q}%`, `%${q}%`)
  if (tag) params.push(`%${tag}%`)
  if (subject_id && subject_id !== 'none') params.push(subject_id)

  query += ' ORDER BY COALESCE(position, 999999) ASC, updated_at DESC'
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
  const { title, content, tags = '', subject_id, section } = await c.req.json<{ title: string; content: string; tags?: string; subject_id?: string; section?: string }>()
  if (!title) return c.json({ error: 'title required' }, 400)

  const id = nanoid()
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO notes (id, title, content, source_type, tags, subject_id, section, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, title, content || '', 'text', tags, subject_id || null, section || null, now, now)
    .run()

  // Index embedding in background (don't block response)
  c.executionCtx.waitUntil(
    embed(c.env.AI, `${title}\n\n${content || ''}`).then((vector) =>
      c.env.VECTORIZE.upsert([{ id, values: vector, metadata: { title } }])
    ).catch(() => {})
  )

  return c.json({ id, title, content, source_type: 'text', tags, subject_id: subject_id || null, section: section || null, created_at: now, updated_at: now }, 201)
})

notes.put('/:id', async (c) => {
  const body = await c.req.json<{ title?: string; content?: string; tags?: string; subject_id?: string | null; section?: string | null; position?: number | null }>()
  const { title, content, tags, subject_id, section, position } = body
  const now = Date.now()
  await c.env.DB.prepare(
    'UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), tags = COALESCE(?, tags), subject_id = COALESCE(?, subject_id), section = COALESCE(?, section), position = COALESCE(?, position), updated_at = ? WHERE id = ?',
  )
    .bind(title ?? null, content ?? null, tags ?? null, subject_id !== undefined ? (subject_id || null) : null, section ?? null, position ?? null, now, c.req.param('id'))
    .run()

  const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(c.req.param('id'))
    .first<any>()

  // Re-index if title or content changed
  if (note && (title !== undefined || content !== undefined)) {
    c.executionCtx.waitUntil(
      embed(c.env.AI, `${note.title}\n\n${note.content || ''}`).then((vector) =>
        c.env.VECTORIZE.upsert([{ id: note.id, values: vector, metadata: { title: note.title } }])
      ).catch(() => {})
    )
  }

  return c.json(note)
})

notes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const note = await c.env.DB.prepare('SELECT file_key FROM notes WHERE id = ?')
    .bind(id).first<{ file_key: string | null }>()
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run()
  c.executionCtx.waitUntil(
    Promise.all([
      c.env.VECTORIZE.deleteByIds([id]).catch(() => {}),
      note?.file_key ? c.env.FILES.delete(note.file_key).catch(() => {}) : Promise.resolve(),
    ])
  )
  return c.json({ ok: true })
})
