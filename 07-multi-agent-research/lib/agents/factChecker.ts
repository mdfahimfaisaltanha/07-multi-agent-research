import { chatJson } from "@/lib/llm"
import type { Claim, ClaimVerdict, Source, SourceSummary } from "@/lib/types"

/**
 * FACT-CHECKER AGENT
 * 1. Extracts the candidate claims that would answer the research question.
 * 2. Cross-checks each claim against ALL source summaries.
 * 3. The LLM returns per-claim verdicts + supporting/contradicting source ids;
 *    the final confidence number is computed DETERMINISTICALLY in code from
 *    source count, quality, and agreement — not by model vibes.
 */

const SYSTEM = `You are a rigorous fact-checker. You will receive a research question and numbered source summaries.

Task: extract 5-10 distinct factual claims that are relevant to answering the question, then check each claim against ALL sources.

Rules:
- A source SUPPORTS a claim only if its facts actually assert it (not merely mention the topic).
- A source CONTRADICTS a claim if its facts assert the opposite or materially conflict.
- verdicts: "supported" (≥1 support, no contradictions), "partially_supported" (support with caveats or weak evidence), "contradicted" (any credible contradiction), "unverified" (no source clearly supports it).
- Be conservative: when in doubt, downgrade the verdict.
- note: one short sentence on nuance/disagreement (empty string if none).`

type RawClaim = {
  text: string
  verdict: ClaimVerdict
  supportedBy: number[]
  contradictedBy: number[]
  note: string
}

function validate(data: unknown): RawClaim[] | null {
  if (typeof data !== "object" || data === null) return null
  const claims = (data as Record<string, unknown>).claims
  if (!Array.isArray(claims)) return null
  const verdicts = new Set(["supported", "partially_supported", "contradicted", "unverified"])
  const out: RawClaim[] = []
  for (const c of claims) {
    if (typeof c !== "object" || c === null) continue
    const r = c as Record<string, unknown>
    if (typeof r.text !== "string" || r.text.trim() === "") continue
    out.push({
      text: r.text.trim(),
      verdict: verdicts.has(r.verdict as string) ? (r.verdict as ClaimVerdict) : "unverified",
      supportedBy: Array.isArray(r.supportedBy) ? r.supportedBy.filter((n): n is number => typeof n === "number") : [],
      contradictedBy: Array.isArray(r.contradictedBy) ? r.contradictedBy.filter((n): n is number => typeof n === "number") : [],
      note: typeof r.note === "string" ? r.note : "",
    })
  }
  return out.length > 0 ? out : null
}

/**
 * Deterministic confidence model (0-100), documented in the README:
 *   base by verdict (supported 55 / partial 35 / contradicted 15 / unverified 10)
 * + up to 30 for independent supporting sources (12 each, capped)
 * + up to 15 for source quality (high 5, medium 2.5 each, capped)
 * - 20 per contradicting source (floor 5)
 */
export function computeConfidence(
  claim: RawClaim,
  summaries: Map<number, SourceSummary>,
): number {
  const base: Record<ClaimVerdict, number> = {
    supported: 55,
    partially_supported: 35,
    contradicted: 15,
    unverified: 10,
  }
  let score = base[claim.verdict]
  score += Math.min(30, claim.supportedBy.length * 12)
  let qualityBonus = 0
  for (const id of claim.supportedBy) {
    const q = summaries.get(id)?.sourceQuality
    qualityBonus += q === "high" ? 5 : q === "medium" ? 2.5 : 0
  }
  score += Math.min(15, qualityBonus)
  score -= claim.contradictedBy.length * 20
  return Math.round(Math.max(5, Math.min(100, score)))
}

export async function factCheck(
  question: string,
  sources: Source[],
  summaries: SourceSummary[],
): Promise<Claim[]> {
  const summaryMap = new Map(summaries.map((s) => [s.sourceId, s]))
  const sourceBlock = sources
    .map((s) => {
      const sum = summaryMap.get(s.id)
      return `[${s.id}] ${s.title} (quality: ${sum?.sourceQuality ?? "medium"})\n${(sum?.keyFacts ?? []).map((f) => `- ${f}`).join("\n")}`
    })
    .join("\n\n")

  const raw = await chatJson<RawClaim[]>({
    system: SYSTEM,
    user: `RESEARCH QUESTION: ${question}\n\nSOURCE SUMMARIES:\n${sourceBlock}\n\nReturn JSON: {"claims": [{"text": "...", "verdict": "supported|partially_supported|contradicted|unverified", "supportedBy": [1], "contradictedBy": [], "note": "..."}]}`,
    validate,
  })

  const validIds = new Set(sources.map((s) => s.id))
  return raw.map((c) => {
    // Drop hallucinated source ids before computing confidence.
    const supportedBy = c.supportedBy.filter((id) => validIds.has(id))
    const contradictedBy = c.contradictedBy.filter((id) => validIds.has(id))
    const clean = { ...c, supportedBy, contradictedBy }
    return { ...clean, confidence: computeConfidence(clean, summaryMap) }
  })
}
