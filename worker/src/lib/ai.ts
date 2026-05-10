// 70B: best quality, use for reasoning-heavy tasks
export const MODEL_70B = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
// 8B: faster + cheaper, good enough for simple extraction tasks
const MODEL_8B = '@cf/meta/llama-3.1-8b-instruct'
// Embedding model for Vectorize
export const MODEL_EMBED = '@cf/baai/bge-base-en-v1.5'

const MAX_CONTENT_CHARS = 20_000

// Clean up common PDF extraction artifacts before sending to AI
export function cleanText(content: string): string {
  // First pass: find lines that repeat 3+ times (headers/footers) and remove them
  const lines = content.split('\n')
  const lineFreq = new Map<string, number>()
  for (const line of lines) {
    const key = line.trim()
    if (key.length > 3) lineFreq.set(key, (lineFreq.get(key) ?? 0) + 1)
  }
  const repeatedLines = new Set([...lineFreq.entries()].filter(([, n]) => n >= 3).map(([k]) => k))

  return lines
    .filter(line => !repeatedLines.has(line.trim()))
    .join('\n')
    // Remove control characters except newlines/tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove standalone page numbers
    .replace(/^[\s-]*Page\s+\d+(\s+of\s+\d+)?[\s-]*$/gim, '')
    .replace(/^\s*\d+\s*$/gm, '')
    // Remove standalone URLs on their own line
    .replace(/^\s*https?:\/\/\S+\s*$/gm, '')
    // Collapse 3+ consecutive blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Collapse excessive spaces
    .replace(/([^\n]) {3,}/g, '$1 ')
    // Remove repeated dashes/underscores used as PDF dividers
    .replace(/^[-_=]{4,}\s*$/gm, '')
    .trim()
}

export function truncateForAI(content: string): { text: string; truncated: boolean } {
  const cleaned = cleanText(content)
  if (cleaned.length <= MAX_CONTENT_CHARS) return { text: cleaned, truncated: false }
  const half = MAX_CONTENT_CHARS / 2
  const text = cleaned.slice(0, half) +
    '\n\n[... content truncated ...]\n\n' +
    cleaned.slice(cleaned.length - half)
  return { text, truncated: true }
}

async function callAI(ai: Ai, model: string, system: string, userMessage: string, maxTokens = 2048): Promise<string> {
  const response = await ai.run(model as any, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
  }) as any
  if (typeof response === 'string') return response
  if (typeof response?.response === 'string') return response.response
  if (response?.response !== undefined) return JSON.stringify(response.response)
  return JSON.stringify(response)
}

// Use for: quiz generation, ask AI, connections, scenario
export function runAI(ai: Ai, system: string, userMessage: string, maxTokens?: number): Promise<string> {
  return callAI(ai, MODEL_70B, system, userMessage, maxTokens)
}

// Use for: summary, eli5, key terms — simpler extraction tasks
export function runAIFast(ai: Ai, system: string, userMessage: string, maxTokens?: number): Promise<string> {
  return callAI(ai, MODEL_8B, system, userMessage, maxTokens)
}

// Generate embedding vector for a piece of text
export async function embed(ai: Ai, text: string): Promise<number[]> {
  const res = await ai.run(MODEL_EMBED as any, { text: [text.slice(0, 2000)] }) as any
  return res?.data?.[0] ?? []
}
