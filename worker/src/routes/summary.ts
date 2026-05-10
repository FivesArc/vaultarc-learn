import { Hono } from 'hono'
import { Env } from '../index'
import { runAIFast, truncateForAI } from '../lib/ai'

export const summary = new Hono<{ Bindings: Env }>()

summary.post('/', async (c) => {
  try {
    const { note_id } = await c.req.json<{ note_id: string }>()
    if (!note_id) return c.json({ error: 'note_id required' }, 400)

    const note = await c.env.DB.prepare('SELECT title, content FROM notes WHERE id = ?')
      .bind(note_id)
      .first<{ title: string; content: string }>()

    if (!note) return c.json({ error: 'Note not found' }, 404)
    if (!note.content?.trim()) return c.json({ error: 'Note has no content' }, 400)

    const { text: noteText } = truncateForAI(note.content)
    const contentLength = noteText.length

    let system: string
    let maxTokens: number

    if (contentLength < 1500) {
      // Short note — concise, no padding
      system = `You are a study coach. The student has short notes and wants a clear, focused summary to help them understand and remember the content.

Write a brief but genuinely useful summary with:
**What This Is About** — 1-2 sentences on the real purpose or idea
**Key Points** — the most important things to understand from these notes, explained clearly (not just copied)
**Remember This** — one thing that's easy to forget or mix up

Be concise. Match the length of the content — don't pad it out.`
      maxTokens = 1024
    } else if (contentLength < 8000) {
      // Medium note — balanced
      system = `You are a study coach helping a student genuinely understand their notes, not just skim them.

Structure your summary like this:

**What This Is Really About** — 2 sentences on the real-world purpose and why it matters

**The Core Ideas** — for each major concept, a short paragraph explaining it clearly with specific details from the notes. Don't list — explain.

**The Tricky Parts** — 1-2 specific things that are easy to confuse or forget from this content

**Quick Recap** — tight bullet list of the most important facts and definitions to remember

Be specific to this content. Use actual names, numbers, and examples from the notes.`
      maxTokens = 2048
    } else {
      // Large note / PDF — go deep
      system = `You are a world-class study coach. Your job is not to compress notes — it is to help a student genuinely understand and remember everything they studied. Read the notes deeply and produce a thorough learning-focused breakdown.

Structure your output like this:

**What This Is Really About**
2-3 sentences. Explain the real-world purpose — why this exists, what problem it solves, what would break without it.

**The Core Ideas (Explained, Not Listed)**
For each major concept in the notes, write a short paragraph — not a bullet. Explain it like you're talking to someone smart who has never seen it before. Use specific details, numbers, names, and examples from the notes. Cover every significant concept — don't skip things.

**How It All Connects**
3-5 sentences showing the structure underneath — how the concepts relate, which ideas depend on others, the logic that ties it together.

**The Tricky Parts**
2-4 specific things from this content that trip students up. Say exactly what the confusion is and how to resolve it.

**Exam-Ready Recap**
A tight bulleted list of the most testable facts, definitions, steps, and distinctions. Include specific values, names, and relationships from the notes.

Go deep and be specific. A student using this summary to prepare for an exam should feel genuinely ready.`
      maxTokens = 4096
    }

    const text = await runAIFast(c.env.AI, system, `Summarise these notes titled "${note.title}":\n\n${noteText}`, maxTokens)
    return c.json({ summary: text })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'Internal error' }, 500)
  }
})
