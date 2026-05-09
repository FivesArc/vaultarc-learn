import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'
import { extractText, getDocumentProxy } from 'unpdf'

export const uploads = new Hono<{ Bindings: Env }>()

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const buffer = await file.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  }
  return file.text()
}

uploads.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) return c.json({ error: 'file required' }, 400)

  let text: string
  try {
    text = await extractTextFromFile(file)
  } catch (e: any) {
    return c.json({ error: `Failed to extract text: ${e.message}` }, 400)
  }

  if (!text?.trim()) return c.json({ error: 'Could not extract any text from this file' }, 400)

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
