import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

export const connections = new Hono<{ Bindings: Env }>()

connections.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT id, title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ id: string; title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)

    const { results: others } = await c.env.DB.prepare(
      `SELECT id, title, substr(content, 1, 400) as snippet FROM notes WHERE id != ? AND content != '' LIMIT 20`
    ).bind(note_id).all()

    if (others.length === 0) return c.json({ connections: [] })

    const noteList = (others as any[]).map((n) => `ID: ${n.id}\nTitle: ${n.title}\nSnippet: ${n.snippet}`).join('\n---\n')
    const { text } = truncateForAI(note.content)

    const raw = await runAI(c.env.AI,
      `You are a knowledge graph assistant. Given a main note and other notes, find which others are conceptually related.
Output ONLY a JSON array of IDs of related notes. Maximum 4. If none are truly related, return [].
Example output: ["abc123","def456"]
No markdown. No explanation. Just the JSON array.`,
      `Main note: "${note.title}"\nContent (excerpt): ${text.slice(0, 1500)}\n\n---\nOther notes:\n${noteList}`
    )

    let ids: string[] = []
    try {
      const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\[[\s\S]*?\]/)
      ids = match ? JSON.parse(match[0]) : []
    } catch { ids = [] }

    const connected = (others as any[])
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ id: n.id, title: n.title }))

    return c.json({ connections: connected })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
