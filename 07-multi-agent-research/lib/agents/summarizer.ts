import { chatJson } from "@/lib/llm"
import type { Source, SourceSummary } from "@/lib/types"

/**
 * SUMMARIZER AGENT
 * Condenses each source into 3-5 key factual bullets and grades source
 * quality (used later by the Fact-Checker to weight support).
 * Sources are summarized in parallel; a failed summary downgrades gracefully
 * instead of failing the pipeline.
 */

const SYSTEM = `You are a careful research summarizer.
Rules:
- Extract ONLY facts stated in the source text. Never add outside knowledge.
- Each key fact must be a single self-contained sentence with concrete specifics (numbers, names, dates) when present.
- Grade sourceQuality: "high" (primary source, peer-reviewed, official docs, major outlet with attribution), "medium" (reputable blog/trade press), "low" (forum, SEO content, promotional page, no attribution).`

function validate(data: unknown): Omit<SourceSummary, "sourceId"> | null {
  if (typeof data !== "object" || data === null) return null
  const d = data as Record<string, unknown>
  const keyFacts = Array.isArray(d.keyFacts)
    ? d.keyFacts.filter((f): f is string => typeof f === "string" && f.trim() !== "")
    : []
  if (keyFacts.length === 0) return null
  const quality =
    d.sourceQuality === "high" || d.sourceQuality === "medium" || d.sourceQuality === "low"
      ? d.sourceQuality
      : "medium"
  return {
    keyFacts: keyFacts.slice(0, 5),
    sourceQuality: quality,
    qualityReason: typeof d.qualityReason === "string" ? d.qualityReason : "",
  }
}

async function summarizeOne(source: Source): Promise<SourceSummary> {
  const result = await chatJson<Omit<SourceSummary, "sourceId">>({
    system: SYSTEM,
    user: `SOURCE TITLE: ${source.title}\nSOURCE URL: ${source.url}\n\nSOURCE TEXT:\n"""\n${source.content}\n"""\n\nReturn JSON: {"keyFacts": ["..."], "sourceQuality": "high|medium|low", "qualityReason": "..."}`,
    validate,
  })
  return { sourceId: source.id, ...result }
}

export async function summarizeSources(sources: Source[]): Promise<SourceSummary[]> {
  const settled = await Promise.allSettled(sources.map((s) => summarizeOne(s)))
  const summaries: SourceSummary[] = []
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      summaries.push(r.value)
    } else {
      // Graceful degradation: keep the source usable with a low-quality grade.
      summaries.push({
        sourceId: sources[i].id,
        keyFacts: [sources[i].content.slice(0, 300)],
        sourceQuality: "low",
        qualityReason: "Automatic summary failed; using raw snippet.",
      })
    }
  })
  return summaries
}
