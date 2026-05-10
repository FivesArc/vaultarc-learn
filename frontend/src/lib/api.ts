const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error)
  }
  return res.json() as Promise<T>
}

export type Subject = {
  id: string
  name: string
  color: string
  exam?: string | null
  created_at: number
  note_count: number
}

export type Note = {
  id: string
  title: string
  content: string
  source_type: 'text' | 'upload'
  tags?: string
  subject_id?: string | null
  section?: string | null
  position?: number | null
  created_at: number
  updated_at: number
}

export type Question = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export type Quiz = {
  id: string
  note_id: string
  title: string
  questions: Question[]
  created_at: number
}

export type QuizResult = {
  id: string
  score: number
  total: number
  percent: number
}

export type Flashcard = { front: string; back: string }

export type ProgressResult = {
  id: string
  quiz_id: string
  score: number
  total: number
  answers: string
  taken_at: number
  quiz_title: string
  note_id: string
  questions: string
  note_title: string
}

export const api = {
  notes: {
    list: (q?: string, tag?: string, subject_id?: string) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (tag) params.set('tag', tag)
      if (subject_id) params.set('subject_id', subject_id)
      const qs = params.toString()
      return req<Note[]>(`/notes${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => req<Note>(`/notes/${id}`),
    tags: () => req<string[]>('/notes/tags'),
    create: (title: string, content: string, tags = '', subject_id?: string, section?: string) =>
      req<Note>('/notes', { method: 'POST', body: JSON.stringify({ title, content, tags, subject_id, section }) }),
    update: (id: string, data: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'subject_id' | 'section' | 'position'>>) =>
      req<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
  },
  subjects: {
    list: () => req<Subject[]>('/subjects'),
    create: (name: string, color?: string) =>
      req<Subject>('/subjects', { method: 'POST', body: JSON.stringify({ name, color }) }),
    update: (id: string, data: Partial<Pick<Subject, 'name' | 'color' | 'exam'>>) =>
      req<Subject>(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<{ ok: boolean }>(`/subjects/${id}`, { method: 'DELETE' }),
  },
  upload: (file: File, title?: string, subject_id?: string, section?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (title) fd.append('title', title)
    if (subject_id) fd.append('subject_id', subject_id)
    if (section) fd.append('section', section)
    return fetch(`${BASE}/uploads`, { method: 'POST', body: fd, headers: { 'x-api-key': API_KEY } }).then((r) => r.json() as Promise<Note>)
  },
  ask: (ctx: { note_id?: string; subject_id?: string; section?: string }, question: string) =>
    req<{ question: string; answer: string; sources: { id: string; title: string }[] }>('/ask', {
      method: 'POST',
      body: JSON.stringify({ ...ctx, question }),
    }),
  askStream: (
    ctx: { note_id?: string; subject_id?: string; section?: string },
    question: string,
    onToken: (token: string) => void,
    onSources: (sources: { id: string; title: string }[]) => void,
  ): Promise<void> => {
    return fetch(`${BASE}/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ ...ctx, question }),
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json() as any).error ?? res.statusText)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          if (data.startsWith('[SOURCES]')) {
            try { onSources(JSON.parse(data.slice(9))) } catch { /* ignore */ }
            continue
          }
          try {
            const parsed = JSON.parse(data)
            const token = parsed?.response ?? ''
            if (token) onToken(token)
          } catch { /* partial chunk */ }
        }
      }
    })
  },
  summary: (note_id: string) =>
    req<{ summary: string }>('/summary', { method: 'POST', body: JSON.stringify({ note_id }) }),
  flashcards: {
    generate: (note_id: string, count = 10) =>
      req<{ note_id: string; cards: Flashcard[] }>('/flashcards/generate', {
        method: 'POST',
        body: JSON.stringify({ note_id, count }),
      }),
  },
  quiz: {
    generate: (note_id: string, count = 5) =>
      req<Quiz>('/quiz/generate', { method: 'POST', body: JSON.stringify({ note_id, count }) }),
    generateForSubject: (subject_id: string, count = 10) =>
      req<{ subject_id: string; subject_name: string; title: string; questions: Question[] }>(
        '/quiz/subject', { method: 'POST', body: JSON.stringify({ subject_id, count }) }
      ),
    get: (id: string) => req<Quiz>(`/quiz/${id}`),
    listForNote: (note_id: string) => req<Quiz[]>(`/quiz/note/${note_id}`),
    submit: (quiz_id: string, answers: number[]) =>
      req<QuizResult>(`/quiz/${quiz_id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
    results: (quiz_id: string) => req<QuizResult[]>(`/quiz/${quiz_id}/results`),
    delete: (quiz_id: string) => req<{ ok: boolean }>(`/quiz/${quiz_id}`, { method: 'DELETE' }),
  },
  eli5: (note_id: string) =>
    req<{ explanation: string }>('/eli5', { method: 'POST', body: JSON.stringify({ note_id }) }),
  scenario: {
    generate: (note_id: string, count = 5) =>
      req<{ note_id: string; title: string; questions: Question[] }>('/scenario/generate', {
        method: 'POST', body: JSON.stringify({ note_id, count }),
      }),
  },
  progress: () => req<ProgressResult[]>('/progress'),
  connections: (note_id: string) =>
    req<{ connections: { id: string; title: string }[] }>('/connections', {
      method: 'POST', body: JSON.stringify({ note_id }),
    }),
  keyterms: (note_id: string) =>
    req<{ terms: string[] }>('/keyterms', { method: 'POST', body: JSON.stringify({ note_id }) }),
  priority: (note_id: string) =>
    req<{
      must_know: { concept: string; why: string; anchor: string }[]
      should_know: { concept: string; why: string; anchor: string }[]
      nice_to_know: { concept: string; why: string; anchor: string }[]
    }>('/priority', { method: 'POST', body: JSON.stringify({ note_id }) }),
  teachback: {
    question: (note_id: string) =>
      req<{ question: string }>('/teachback/question', { method: 'POST', body: JSON.stringify({ note_id }) }),
    evaluate: (note_id: string, question: string, answer: string) =>
      req<{ score: 'strong' | 'partial' | 'needs_work'; got_right: string; missed: string; remember: string }>(
        '/teachback/evaluate', { method: 'POST', body: JSON.stringify({ note_id, question, answer }) }
      ),
  },
  mindmap: (note_id: string) =>
    req<{ center: string; branches: { name: string; children: string[] }[] }>(
      '/mindmap', { method: 'POST', body: JSON.stringify({ note_id }) }
    ),
}

export type Message = { role: 'user' | 'assistant'; text: string }

export type ChatSession = {
  id: string
  type: 'note' | 'section' | 'subject'
  contextId: string      // note_id or subject_id
  section?: string       // only for section type
  label: string          // human-readable name
  sublabel: string       // e.g. subject name or "Note"
  messages: Message[]
  createdAt: number
  updatedAt: number
}

const SESSIONS_KEY = 'vaultarc-sessions'

export function loadSessions(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
  } catch { return [] }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 100)))
}

export function createSession(type: ChatSession['type'], contextId: string, label: string, sublabel: string, section?: string): ChatSession {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, contextId, section, label, sublabel, messages: [], createdAt: Date.now(), updatedAt: Date.now() }
}

export function saveSession(session: ChatSession) {
  const sessions = loadSessions()
  const idx = sessions.findIndex(s => s.id === session.id)
  const updated = { ...session, updatedAt: Date.now() }
  if (idx >= 0) sessions[idx] = updated
  else sessions.unshift(updated)
  saveSessions(sessions.sort((a, b) => b.updatedAt - a.updatedAt))
}

export function deleteSession(id: string) {
  saveSessions(loadSessions().filter(s => s.id !== id))
}

// Legacy helpers kept for any remaining references
export function loadChatHistory(_key: string): Message[] { return [] }
export function saveChatHistory(_key: string, _msgs: Message[]) {}
export function clearChatHistory(_key: string) {}
