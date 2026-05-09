// Simple SM-2 spaced repetition
export type CardState = {
  front: string
  back: string
  interval: number   // days until next review
  easeFactor: number
  dueDate: number    // timestamp
  reps: number
}

export function rateCard(card: CardState, rating: 1 | 2 | 3): CardState {
  // rating: 1=hard, 2=ok, 3=easy
  let { interval, easeFactor, reps } = card
  if (rating === 1) {
    interval = 1
    reps = 0
  } else if (rating === 2) {
    interval = reps === 0 ? 1 : Math.round(interval * easeFactor)
    reps += 1
  } else {
    interval = reps === 0 ? 4 : Math.round(interval * easeFactor)
    easeFactor = Math.min(easeFactor + 0.1, 2.5)
    reps += 1
  }
  easeFactor = Math.max(1.3, easeFactor - 0.1 + 0.1 * rating)
  const dueDate = Date.now() + interval * 86_400_000
  return { ...card, interval, easeFactor, reps, dueDate }
}

export function initCard(front: string, back: string): CardState {
  return { front, back, interval: 1, easeFactor: 2.5, dueDate: Date.now(), reps: 0 }
}

const SRS_KEY = 'vaultarc-srs'

export function loadDeck(noteId: string): CardState[] {
  try {
    const raw = localStorage.getItem(`${SRS_KEY}-${noteId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveDeck(noteId: string, deck: CardState[]) {
  localStorage.setItem(`${SRS_KEY}-${noteId}`, JSON.stringify(deck))
}

export function getDueCards(deck: CardState[]): CardState[] {
  return deck.filter((c) => c.dueDate <= Date.now())
}
