import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { notes } from './routes/notes'
import { ask } from './routes/ask'
import { quiz } from './routes/quiz'
import { uploads } from './routes/uploads'
import { summary } from './routes/summary'
import { flashcards } from './routes/flashcards'
import { eli5 } from './routes/eli5'
import { scenario } from './routes/scenario'
import { progress } from './routes/progress'
import { connections } from './routes/connections'
import { keyterms } from './routes/keyterms'

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
app.route('/summary', summary)
app.route('/flashcards', flashcards)
app.route('/eli5', eli5)
app.route('/scenario', scenario)
app.route('/progress', progress)
app.route('/connections', connections)
app.route('/keyterms', keyterms)

export default app
