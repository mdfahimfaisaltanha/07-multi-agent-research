import OpenAI from "openai"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"

/**
 * Call the chat model expecting a validated JSON object, with one
 * self-correcting retry on invalid output.
 */
export async function chatJson<T>(opts: {
  system: string
  user: string
  validate: (data: unknown) => T | null
  temperature?: number
}): Promise<T> {
  let lastError = ""
  for (let attempt = 0; attempt <= 1; attempt++) {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        {
          role: "user",
          content:
            attempt === 0
              ? opts.user
              : `${opts.user}\n\nYour previous output was invalid (${lastError}). Return ONLY a valid JSON object matching the requested shape.`,
        },
      ],
    })
    const raw = res.choices[0]?.message?.content ?? ""
    try {
      const valid = opts.validate(JSON.parse(raw))
      if (valid !== null) return valid
      lastError = "JSON did not match the expected shape"
    } catch {
      lastError = "output was not parseable JSON"
    }
  }
  throw new Error(`LLM returned invalid output after 2 attempts (${lastError}).`)
}

/** Plain-text chat completion (used by the Writer agent). */
export async function chatText(opts: {
  system: string
  user: string
  temperature?: number
}): Promise<string> {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: opts.temperature ?? 0.4,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  })
  return res.choices[0]?.message?.content ?? ""
}
