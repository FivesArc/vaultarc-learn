import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { notes } from './routes/notes'
import { ask } from './routes/ask'
import { quiz } from './routes/quiz'
import { uploads } from './routes/uploads'
import { summary } from './routes/summary'
import { flashcards } from './routes/flashcards'
import { eli5 } from './routes/eli5'
import { subjects } from './routes/subjects'
import { scenario } from './routes/scenario'
import { progress } from './routes/progress'
import { connections } from './routes/connections'
import { keyterms } from './routes/keyterms'
import { priority } from './routes/priority'
import { teachback } from './routes/teachback'
import { mindmap } from './routes/mindmap'

export type Env = {
  DB: D1Database
  FILES: R2Bucket
  AI: Ai
  VECTORIZE: VectorizeIndex
  FRONTEND_URL: string
  API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  return cors({
    origin: [c.env.FRONTEND_URL, 'https://vaultarc-learn.pages.dev', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-api-key'],
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

// Auth middleware — skip preflight OPTIONS, then check API key
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next()
  const key = c.env.API_KEY
  if (!key) return next()
  const auth = c.req.header('x-api-key')
  if (!auth || auth !== key) return c.json({ error: 'Unauthorized' }, 401)
  return next()
})

app.route('/notes', notes)
app.route('/ask', ask)
app.route('/quiz', quiz)
app.route('/uploads', uploads)
app.route('/summary', summary)
app.route('/flashcards', flashcards)
app.route('/eli5', eli5)
app.route('/subjects', subjects)
app.route('/scenario', scenario)
app.route('/progress', progress)
app.route('/connections', connections)
app.route('/keyterms', keyterms)
app.route('/priority', priority)
app.route('/teachback', teachback)
app.route('/mindmap', mindmap)

export default app
