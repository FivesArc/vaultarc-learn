import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

export const keyterms = new Hono<{ Bindings: Env }>()

keyterms.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT content FROM notes WHERE id = ?')
      .bind(note_id).first<{ content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)

    const { text } = truncateForAI(note.content)
    const raw = await runAI(c.env.AI,
      `Extract the most important key terms and concepts from the notes provided.
Output ONLY a JSON array of strings (the terms). Maximum 12 terms. Short phrases only (1-4 words each).
Example: ["digital signature","hash function","non-repudiation","public key"]
No markdown. No explanation.`,
      text
    )

    let terms: string[] = []
    try {
      const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\[[\s\S]*?\]/)
      terms = match ? JSON.parse(match[0]) : []
    } catch { terms = [] }

    return c.json({ terms })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
