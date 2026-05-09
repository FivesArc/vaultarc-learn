const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error)
  }
  return res.json() as Promise<T>
}

export type Note = {
  id: string
  title: string
  content: string
  source_type: 'text' | 'upload'
  tags?: string
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

export const api = {
  notes: {
    list: (q?: string) => req<Note[]>(`/notes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    get: (id: string) => req<Note>(`/notes/${id}`),
    create: (title: string, content: string) =>
      req<Note>('/notes', { method: 'POST', body: JSON.stringify({ title, content }) }),
    update: (id: string, data: Partial<Pick<Note, 'title' | 'content'>>) =>
      req<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
  },
  upload: (file: File, title?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (title) fd.append('title', title)
    return fetch(`${BASE}/uploads`, { method: 'POST', body: fd }).then((r) => r.json() as Promise<Note>)
  },
  ask: (note_id: string, question: string) =>
    req<{ question: string; answer: string }>('/ask', {
      method: 'POST',
      body: JSON.stringify({ note_id, question }),
    }),
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
    get: (id: string) => req<Quiz>(`/quiz/${id}`),
    listForNote: (note_id: string) => req<Quiz[]>(`/quiz/note/${note_id}`),
    submit: (quiz_id: string, answers: number[]) =>
      req<QuizResult>(`/quiz/${quiz_id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
    results: (quiz_id: string) => req<QuizResult[]>(`/quiz/${quiz_id}/results`),
  },
}

// localStorage helpers for chat history
const CHAT_KEY = 'vaultarc-chat'
export type Message = { role: 'user' | 'assistant'; text: string }

export function loadChatHistory(note_id: string): Message[] {
  try {
    const raw = localStorage.getItem(`${CHAT_KEY}-${note_id}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveChatHistory(note_id: string, messages: Message[]) {
  localStorage.setItem(`${CHAT_KEY}-${note_id}`, JSON.stringify(messages.slice(-50)))
}

export function clearChatHistory(note_id: string) {
  localStorage.removeItem(`${CHAT_KEY}-${note_id}`)
}
