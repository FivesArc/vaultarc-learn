import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'

export const uploads = new Hono<{ Bindings: Env }>()

uploads.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) return c.json({ error: 'file required' }, 400)

  const text = await file.text()
  const fileKey = `uploads/${nanoid()}-${file.name}`

  await c.env.FILES.put(fileKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const id = nanoid()
  const now = Date.now()
  const noteTitle = title || file.name.replace(/\.[^.]+$/, '')

  await c.env.DB.prepare(
    'INSERT INTO notes (id, title, content, source_type, file_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, noteTitle, text, 'upload', fileKey, now, now)
    .run()

  return c.json({ id, title: noteTitle, source_type: 'upload', file_key: fileKey }, 201)
})
