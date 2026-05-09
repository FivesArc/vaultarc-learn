import { Hono } from 'hono'
import { Env } from '../index'

export const progress = new Hono<{ Bindings: Env }>()

progress.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT qr.id, qr.quiz_id, qr.score, qr.total, qr.answers, qr.taken_at,
           q.title as quiz_title, q.note_id, q.questions,
           n.title as note_title
    FROM quiz_results qr
    JOIN quizzes q ON q.id = qr.quiz_id
    JOIN notes n ON n.id = q.note_id
    ORDER BY qr.taken_at DESC
    LIMIT 100
  `).all()
  return c.json(results)
})
