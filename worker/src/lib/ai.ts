// llama-3.3-70b: 128K context window, much better quality than 8B
// Uses ~8x more neurons but still within CF free tier for personal use
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

// Safe limit: ~20K chars of note content to stay well within context window
const MAX_CONTENT_CHARS = 20_000

export function truncateForAI(content: string): { text: string; truncated: boolean } {
  if (content.length <= MAX_CONTENT_CHARS) return { text: content, truncated: false }
  const half = MAX_CONTENT_CHARS / 2
  const text = content.slice(0, half) +
    '\n\n[... content truncated for AI processing — middle section omitted ...]\n\n' +
    content.slice(content.length - half)
  return { text, truncated: true }
}

export async function runAI(ai: Ai, system: string, userMessage: string): Promise<string> {
  const response = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 2048,
  }) as { response: string }

  return response.response ?? ''
}
