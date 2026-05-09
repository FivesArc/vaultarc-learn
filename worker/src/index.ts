import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { notes } from './routes/notes'
import { ask } from './routes/ask'
import { quiz } from './routes/quiz'
import { uploads } from './routes/uploads'

export type Env = {
  DB: D1Database
  FILES: R2Bucket
  AI: Ai
  FRONTEND_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  return cors({
    origin: [c.env.FRONTEND_URL, 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

app.route('/notes', notes)
app.route('/ask', ask)
app.route('/quiz', quiz)
app.route('/uploads', uploads)

export default app
