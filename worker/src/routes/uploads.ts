import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'
import { extractText, getDocumentProxy } from 'unpdf'

const MAX_FILE_BYTES = 15 * 1024 * 1024   // 15MB hard limit
const MAX_TEXT_CHARS = 120_000             // ~30 pages of text

export const uploads = new Hono<{ Bindings: Env }>()

async function extractTextFromFile(file: File): Promise<{ text: string; truncated: boolean }> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const buffer = await file.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    if (text.length > MAX_TEXT_CHARS) {
      return { text: text.slice(0, MAX_TEXT_CHARS) + '\n\n---\n_Note: PDF was too large — only the first portion was imported._', truncated: true }
    }
    return { text, truncated: false }
  }
  const text = await file.text()
  if (text.length > MAX_TEXT_CHARS) {
    return { text: text.slice(0, MAX_TEXT_CHARS) + '\n\n---\n_Note: File was too large — only the first portion was imported._', truncated: true }
  }
  return { text, truncated: false }
}

uploads.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) return c.json({ error: 'file required' }, 400)
  if (file.size > MAX_FILE_BYTES) return c.json({ error: `File too large. Maximum size is 15MB.` }, 400)

  let text: string
  let truncated: boolean
  try {
    ;({ text, truncated } = await extractTextFromFile(file))
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

  return c.json({ id, title: noteTitle, source_type: 'upload', file_key: fileKey, truncated }, 201)
})
