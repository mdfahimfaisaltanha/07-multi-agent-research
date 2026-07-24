import { runResearch } from "@/lib/orchestrator"
import type { PipelineEvent } from "@/lib/types"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/research — streams newline-delimited JSON pipeline events
 * (NDJSON) so the UI can show live agent progress. We use fetch-streaming
 * rather than EventSource because the request is a POST with a body.
 */
export async function POST(req: Request) {
  let question = ""
  try {
    const body = (await req.json()) as { question?: string }
    question = (body.question ?? "").trim()
  } catch {
    /* fall through to validation below */
  }

  if (!question || question.length < 8) {
    return Response.json(
      { error: "Ask a research question (at least 8 characters)." },
      { status: 400 },
    )
  }
  if (question.length > 500) {
    return Response.json({ error: "Question too long (max 500 characters)." }, { status: 400 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Server is missing OPENAI_API_KEY. Copy .env.example to .env.local and set your keys." },
      { status: 500 },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
      }
      try {
        await runResearch(question, emit)
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "Research pipeline failed unexpectedly.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}
