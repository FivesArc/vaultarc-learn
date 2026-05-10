import { Hono } from 'hono'
import { Env } from '../index'
import { runAI, truncateForAI } from '../lib/ai'

export type MindMapBranch = {
  name: string
  children: string[]
}

export type MindMapResult = {
  center: string
  branches: MindMapBranch[]
}

export const mindmap = new Hono<{ Bindings: Env }>()

mindmap.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id).first<{ title: string; content: string }>()
    if (!note) return c.json({ error: 'Not found' }, 404)

    const { text } = truncateForAI(note.content)
    const raw = await runAI(c.env.AI,
      `You are a study assistant creating a compact visual mind map from notes.
Pick only the TOP 3 most important concept areas — ignore minor details.

Rules:
- center: the main topic (3 words max)
- branches: EXACTLY 3 branches — the 3 most critical concept areas only
- each branch has EXACTLY 2 children — the 2 most important sub-points
- keep all labels SHORT (2-4 words max) — they appear as nodes in a small diagram
- do NOT include every detail — ruthlessly prioritise what matters most

Output ONLY valid JSON, no markdown:
{
  "center": "Main Topic",
  "branches": [
    {"name": "Branch Name", "children": ["child1", "child2"]},
    {"name": "Branch Name", "children": ["child1", "child2"]},
    {"name": "Branch Name", "children": ["child1", "child2"]}
  ]
}`,
      `Notes titled "${note.title}":\n\n${text}`
    )

    try {
      const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      const result: MindMapResult = match ? JSON.parse(match[0]) : { center: note.title, branches: [] }
      return c.json(result)
    } catch {
      return c.json({ center: note.title, branches: [] })
    }
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
