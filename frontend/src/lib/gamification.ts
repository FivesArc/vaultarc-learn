const KEY = 'vaultarc-gamification'

export type Badge = {
  id: string
  label: string
  emoji: string
  desc: string
}

export const BADGE_DEFS: Badge[] = [
  { id: 'first_quiz', label: 'First Quiz', emoji: '🎯', desc: 'Completed your first quiz' },
  { id: 'perfect_score', label: 'Perfect Score', emoji: '💯', desc: 'Got 100% on a quiz' },
  { id: 'quiz_x5', label: 'Quiz Rookie', emoji: '📝', desc: 'Completed 5 quizzes' },
  { id: 'quiz_x20', label: 'Quiz Master', emoji: '🏆', desc: 'Completed 20 quizzes' },
  { id: 'streak_3', label: '3-Day Streak', emoji: '🔥', desc: 'Studied 3 days in a row' },
  { id: 'streak_7', label: 'Week Warrior', emoji: '⚡', desc: 'Studied 7 days in a row' },
  { id: 'simplifier', label: 'Simplifier', emoji: '💡', desc: 'Used ELI5 to simplify a note' },
  { id: 'scenario_ace', label: 'Scenario Ace', emoji: '🎭', desc: 'Completed a scenario quiz' },
  { id: 'flashcard_reviewer', label: 'Card Shark', emoji: '🃏', desc: 'Reviewed flashcards with SRS' },
  { id: 'connector', label: 'Connector', emoji: '🔗', desc: 'Found concept connections' },
]

export type GamificationState = {
  xp: number
  streak: number
  lastStudyDate: string
  badges: string[]
  totalQuizzes: number
}

export function loadGamification(): GamificationState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { xp: 0, streak: 0, lastStudyDate: '', badges: [], totalQuizzes: 0 }
  } catch {
    return { xp: 0, streak: 0, lastStudyDate: '', badges: [], totalQuizzes: 0 }
  }
}

function save(state: GamificationState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function touchStreak(state: GamificationState) {
  const today = new Date().toISOString().split('T')[0]
  if (state.lastStudyDate === today) return
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  state.streak = state.lastStudyDate === yesterday ? state.streak + 1 : 1
  state.lastStudyDate = today
}

export function awardXP(amount: number): { state: GamificationState; newBadges: Badge[] } {
  const state = loadGamification()
  state.xp += amount
  touchStreak(state)

  const newBadges: Badge[] = []
  function tryBadge(id: string) {
    if (!state.badges.includes(id)) {
      state.badges.push(id)
      const def = BADGE_DEFS.find((b) => b.id === id)
      if (def) newBadges.push(def)
    }
  }

  if (state.streak >= 3) tryBadge('streak_3')
  if (state.streak >= 7) tryBadge('streak_7')

  save(state)
  return { state, newBadges }
}

export function recordQuizComplete(score: number, total: number, isScenario = false): { state: GamificationState; newBadges: Badge[] } {
  const state = loadGamification()
  const pct = score / total
  state.xp += Math.round(50 + pct * 50)
  state.totalQuizzes += 1
  touchStreak(state)

  const newBadges: Badge[] = []
  function tryBadge(id: string) {
    if (!state.badges.includes(id)) {
      state.badges.push(id)
      const def = BADGE_DEFS.find((b) => b.id === id)
      if (def) newBadges.push(def)
    }
  }

  tryBadge('first_quiz')
  if (pct === 1) tryBadge('perfect_score')
  if (state.totalQuizzes >= 5) tryBadge('quiz_x5')
  if (state.totalQuizzes >= 20) tryBadge('quiz_x20')
  if (state.streak >= 3) tryBadge('streak_3')
  if (state.streak >= 7) tryBadge('streak_7')
  if (isScenario) tryBadge('scenario_ace')

  save(state)
  return { state, newBadges }
}

export function recordAction(action: 'eli5' | 'flashcard_review' | 'connections'): void {
  const state = loadGamification()
  const map: Record<string, string> = { eli5: 'simplifier', flashcard_review: 'flashcard_reviewer', connections: 'connector' }
  state.xp += 10
  touchStreak(state)
  if (map[action] && !state.badges.includes(map[action])) {
    state.badges.push(map[action])
  }
  save(state)
}

// Weak areas stored separately
const WEAK_KEY = 'vaultarc-weak-areas'

export type WeakArea = {
  question: string
  note_title: string
  wrong_count: number
  last_wrong: number
}

export function addWeakAreas(questions: { question: string; note_title: string }[]) {
  const raw = localStorage.getItem(WEAK_KEY)
  const areas: WeakArea[] = raw ? JSON.parse(raw) : []
  for (const q of questions) {
    const existing = areas.find((a) => a.question === q.question)
    if (existing) {
      existing.wrong_count += 1
      existing.last_wrong = Date.now()
    } else {
      areas.push({ question: q.question, note_title: q.note_title, wrong_count: 1, last_wrong: Date.now() })
    }
  }
  // Keep top 30 most recent
  areas.sort((a, b) => b.last_wrong - a.last_wrong)
  localStorage.setItem(WEAK_KEY, JSON.stringify(areas.slice(0, 30)))
}

export function loadWeakAreas(): WeakArea[] {
  try {
    const raw = localStorage.getItem(WEAK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function removeWeakArea(question: string) {
  const areas = loadWeakAreas().filter((a) => a.question !== question)
  localStorage.setItem(WEAK_KEY, JSON.stringify(areas))
}
