import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

export type PriorityItem = {
  concept: string
  why: string
  anchor: string
}

export type PriorityResult = {
  must_know: PriorityItem[]
  should_know: PriorityItem[]
  nice_to_know: PriorityItem[]
}

export const priority = new Hono<{ Bindings: Env }>()

priority.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    if (!note_id) return c.json({ error: 'note_id required' }, 400)

    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id)
      .first<{ title: string; content: string }>()

    if (!note) return c.json({ error: 'Note not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'Note has no content' }, 400)

    const { text: noteText } = truncateForAI(note.content)

    const raw = await runAI(c.env.AI,
      `You are a master tutor who knows exactly what to focus on to build understanding efficiently.
Analyse these notes and ruthlessly prioritise what the student needs to know.

Buckets:
- must_know: 2-4 concepts that are the foundation everything else builds on. Without these, nothing else makes sense. If you had one hour to study, spend it here.
- should_know: 3-5 concepts that deepen understanding and fill in the picture. Important, but only after must_know is solid.
- nice_to_know: interesting details, edge cases, extra context — valuable but skippable under time pressure.

For each concept:
- concept: short name (3-6 words max)
- why: one sentence — specifically WHY this belongs at this priority level (not just "it's important")
- anchor: a concrete real-world analogy or example that makes this concept stick (1-2 sentences, plain language)

Output ONLY valid JSON, no markdown:
{
  "must_know": [{"concept":"...","why":"...","anchor":"..."}],
  "should_know": [{"concept":"...","why":"...","anchor":"..."}],
  "nice_to_know": [{"concept":"...","why":"...","anchor":"..."}]
}`,
      `Notes titled "${note.title}":\n\n${noteText}`
    )

    let result: PriorityResult
    try {
      const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      result = match ? JSON.parse(match[0]) : { must_know: [], should_know: [], nice_to_know: [] }
    } catch {
      result = { must_know: [], should_know: [], nice_to_know: [] }
    }

    return c.json(result)
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
