const MODEL = '@cf/meta/llama-3.1-8b-instruct'

export async function runAI(ai: Ai, system: string, userMessage: string): Promise<string> {
  const response = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  }) as { response: string }

  return response.response ?? ''
}
