import { Hono } from 'hono'
import { Env } from '../index'
import { runAIFast as runAI, truncateForAI } from '../lib/ai'

export const eli5 = new Hono<{ Bindings: Env }>()

eli5.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'No content' }, 400)

    const { text } = truncateForAI(note.content)
    const explanation = await runAI(c.env.AI,
      `You are a brilliant teacher who can make any complex topic click instantly.
Your goal is not to dumb things down — it is to build genuine understanding through analogy and story.

Rules:
- Open with one powerful analogy that captures the whole topic (make it vivid and concrete)
- Explain each key concept by answering "what is this LIKE in real life?" — use things everyone has experienced
- Short sentences. Bold the concept when you first introduce it.
- Point out what makes this topic tricky — where do people get confused, and why
- Close with: "**The one thing to remember:** ..." — one sentence that will stick

Never say "imagine" as your first word. Start with the analogy directly.`,
      `Explain the key concepts from these notes so they genuinely make sense:\n\n${text}`
    )
    return c.json({ explanation })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
