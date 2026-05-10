import { Hono } from 'hono'
import { Env } from '../index'
import { embed, truncateForAI, cleanText, MODEL_70B } from '../lib/ai'

export const ask = new Hono<{ Bindings: Env }>()

async function buildContext(c: any, body: {
  note_id?: string; subject_id?: string; section?: string
}): Promise<{ systemPrompt: string; sources: { id: string; title: string }[] }> {
  let contextTitle = ''
  let contextContent = ''
  let examHint = ''
  const sources: { id: string; title: string }[] = []

  if (body.note_id) {
    const note = await c.env.DB.prepare('SELECT id, title, content, subject_id FROM notes WHERE id = ?')
      .bind(body.note_id).first<{ id: string; title: string; content: string; subject_id: string | null }>()
    if (!note) throw new Error('Note not found')
    contextTitle = note.title
    const { text } = truncateForAI(note.content || '')
    contextContent = text
    sources.push({ id: note.id, title: note.title })

    // Get exam from subject if note belongs to one
    if (note.subject_id) {
      const sub = await c.env.DB.prepare('SELECT exam FROM subjects WHERE id = ?')
        .bind(note.subject_id).first<{ exam: string | null }>()
      if (sub?.exam) examHint = sub.exam
    }

    // RAG: find related notes
    try {
      const qVector = await embed(c.env.AI, contextTitle)
      const similar = await c.env.VECTORIZE.query(qVector, { topK: 3, returnMetadata: 'all' })
      const relatedIds = (similar.matches ?? [])
        .filter((m: any) => m.id !== body.note_id && m.score > 0.65)
        .slice(0, 2).map((m: any) => m.id)
      if (relatedIds.length > 0) {
        const placeholders = relatedIds.map(() => '?').join(',')
        const { results: related } = await c.env.DB.prepare(
          `SELECT id, title, substr(content, 1, 1000) as content FROM notes WHERE id IN (${placeholders})`
        ).bind(...relatedIds).all<{ id: string; title: string; content: string }>()
        if (related.length > 0) {
          contextContent += '\n\nRELATED NOTES:\n' + related.map(r => `## ${r.title}\n${r.content}`).join('\n\n')
          related.forEach(r => sources.push({ id: r.id, title: r.title }))
        }
      }
    } catch { /* RAG is best-effort */ }

  } else if (body.section && body.subject_id) {
    const sub = await c.env.DB.prepare('SELECT name, exam FROM subjects WHERE id = ?')
      .bind(body.subject_id).first<{ name: string; exam: string | null }>()
    if (sub?.exam) examHint = sub.exam
    const { results: notes } = await c.env.DB.prepare(
      'SELECT id, title, content FROM notes WHERE subject_id = ? AND section = ? ORDER BY position ASC, created_at ASC'
    ).bind(body.subject_id, body.section).all<{ id: string; title: string; content: string }>()
    if (!notes.length) throw new Error('No notes found in this section')
    contextTitle = `${body.section} (${sub?.name ?? ''})`
    let total = 0
    for (const n of notes) {
      const chunk = `## ${n.title}\n${cleanText(n.content || '').slice(0, 3000)}`
      if (total + chunk.length > 18000) break
      contextContent += (contextContent ? '\n\n' : '') + chunk
      sources.push({ id: n.id, title: n.title })
      total += chunk.length
    }

  } else if (body.subject_id) {
    const sub = await c.env.DB.prepare('SELECT name, exam FROM subjects WHERE id = ?')
      .bind(body.subject_id).first<{ name: string; exam: string | null }>()
    if (sub?.exam) examHint = sub.exam
    const { results: notes } = await c.env.DB.prepare(
      'SELECT id, title, content FROM notes WHERE subject_id = ? ORDER BY section ASC, position ASC, created_at ASC'
    ).bind(body.subject_id).all<{ id: string; title: string; content: string }>()
    if (!notes.length) throw new Error('No notes found in this subject')
    contextTitle = sub?.name ?? 'Subject'
    let total = 0
    for (const n of notes) {
      const chunk = `## ${n.title}\n${cleanText(n.content || '').slice(0, 2000)}`
      if (total + chunk.length > 18000) break
      contextContent += (contextContent ? '\n\n' : '') + chunk
      sources.push({ id: n.id, title: n.title })
      total += chunk.length
    }
  } else {
    throw new Error('Provide note_id, subject_id, or subject_id + section')
  }

  const examLine = examHint
    ? `\nThe student is preparing for: ${examHint}. Tailor your answers to be exam-relevant — use correct terminology, flag commonly tested concepts, and think like an exam question would.`
    : ''

  const systemPrompt = `You are a helpful study assistant. The student is studying: "${contextTitle}".${examLine} Answer questions based on the notes below. Be concise and clear. If the answer isn't in the notes, say so.

NOTES:
${contextContent || '(no content)'}`

  return { systemPrompt, sources }
}

// Streaming ask endpoint
ask.post('/stream', async (c) => {
  try {
    const body = await c.req.json<{ note_id?: string; subject_id?: string; section?: string; question: string }>()
    if (!body.question) return c.json({ error: 'question required' }, 400)

    const { systemPrompt, sources } = await buildContext(c, body)

    const aiStream = await c.env.AI.run(MODEL_70B as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: body.question },
      ],
      max_tokens: 2048,
      stream: true,
    }) as ReadableStream

    // Pipe AI stream, then append sources as a final SSE event
    const sourcesJson = JSON.stringify(sources)
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Read AI stream and forward, then append sources event
    ;(async () => {
      const reader = aiStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
        // After stream ends, send sources as a custom event
        await writer.write(encoder.encode(`data: [SOURCES]${sourcesJson}\n\n`))
      } finally {
        writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})

// Non-streaming fallback (kept for other features that use ask)
ask.post('/', async (c) => {
  try {
    const body = await c.req.json<{ note_id?: string; subject_id?: string; section?: string; question: string }>()
    if (!body.question) return c.json({ error: 'question required' }, 400)
    const { systemPrompt, sources } = await buildContext(c, body)
    const { runAI } = await import('../lib/ai')
    const answer = await runAI(c.env.AI, systemPrompt, body.question)
    return c.json({ question: body.question, answer, sources })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
