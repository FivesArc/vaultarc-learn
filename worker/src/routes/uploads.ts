import { Hono } from 'hono'
import { Env } from '../index'
import { nanoid } from '../lib/id'
import { extractText, getDocumentProxy } from 'unpdf'
import { embed, cleanText } from '../lib/ai'

const MAX_FILE_BYTES = 15 * 1024 * 1024   // 15MB hard limit
const MAX_TEXT_CHARS = 1_500_000           // ~375 pages — store everything, AI truncates itself

export const uploads = new Hono<{ Bindings: Env }>()

function fixPdfLineBreaks(text: string): string {
  return text
    // Add newline before common bullet/list characters when mid-sentence
    .replace(/([a-z,;])\s*([■●○◆▪▸•])\s*/g, '$1\n$2 ')
    // Add newline before uppercase headings that run into previous text
    .replace(/([a-z,;.])\s+([A-Z][A-Z\s]{3,}:)/g, '$1\n\n$2')
    // Ensure URLs get their own line
    .replace(/\s+(https?:\/\/\S+)/g, '\n$1')
}

async function extractTextFromFile(file: File): Promise<{ text: string; truncated: boolean }> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const buffer = await file.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(buffer))

    // Extract per-page so we can join with newlines (preserves structure better than mergePages)
    const { text: pages } = await extractText(pdf, { mergePages: false }) as { text: string[] }
    let text = Array.isArray(pages) ? pages.join('\n\n') : (pages as any as string)
    text = fixPdfLineBreaks(text)

    if (text.length > MAX_TEXT_CHARS) {
      return { text: text.slice(0, MAX_TEXT_CHARS), truncated: true }
    }
    return { text, truncated: false }
  }

  const text = await file.text()
  if (text.length > MAX_TEXT_CHARS) {
    return { text: text.slice(0, MAX_TEXT_CHARS), truncated: true }
  }
  return { text, truncated: false }
}

uploads.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const subject_id = formData.get('subject_id') as string | null
  const section = formData.get('section') as string | null

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
  text = cleanText(text)

  const fileKey = `uploads/${nanoid()}-${file.name}`
  await c.env.FILES.put(fileKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const id = nanoid()
  const now = Date.now()
  const noteTitle = title || file.name.replace(/\.[^.]+$/, '')

  await c.env.DB.prepare(
    'INSERT INTO notes (id, title, content, source_type, file_key, subject_id, section, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, noteTitle, text, 'upload', fileKey, subject_id || null, section || null, now, now)
    .run()

  c.executionCtx.waitUntil(
    embed(c.env.AI, `${noteTitle}\n\n${text.slice(0, 2000)}`).then((vector) =>
      c.env.VECTORIZE.upsert([{ id, values: vector, metadata: { title: noteTitle } }])
    ).catch(() => {})
  )

  return c.json({ id, title: noteTitle, source_type: 'upload', file_key: fileKey, truncated }, 201)
})
