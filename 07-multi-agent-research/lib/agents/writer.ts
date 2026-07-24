import { chatText } from "@/lib/llm"
import type { Claim, Source } from "@/lib/types"

/**
 * WRITER AGENT
 * Composes the final Markdown report from fact-checked claims ONLY.
 * - Claims below the confidence floor or contradicted are surfaced in a
 *   dedicated "Disputed & unverified" section rather than silently woven in.
 * - Every factual statement must carry [n] citations that map to real sources.
 */

const SYSTEM = `You are a precise research writer. You write a Markdown research brief using ONLY the fact-checked claims provided — no outside knowledge.

Structure:
## Answer
2-4 paragraph synthesis that directly answers the question, weaving in the supported claims with [n] citations after each factual statement.
## Key findings
Bulleted list of the strongest claims, each with its confidence % and citations.
## Disputed & unverified
Bullets for contradicted/unverified/low-confidence claims, each explaining the disagreement (write "None." if empty).

Rules:
- Cite with [n] matching the provided source ids. Never invent citations or facts.
- Reflect confidence honestly: hedge language for partial support ("evidence suggests"), direct language only for high confidence.
- Do NOT include a sources section — the app renders it separately.`

export async function writeReport(
  question: string,
  claims: Claim[],
  sources: Source[],
): Promise<string> {
  const claimBlock = claims
    .map(
      (c) =>
        `- "${c.text}" | verdict: ${c.verdict} | confidence: ${c.confidence}% | supportedBy: [${c.supportedBy.join(", ")}] | contradictedBy: [${c.contradictedBy.join(", ")}]${c.note ? ` | note: ${c.note}` : ""}`,
    )
    .join("\n")

  const sourceBlock = sources.map((s) => `[${s.id}] ${s.title}`).join("\n")

  return chatText({
    system: SYSTEM,
    user: `RESEARCH QUESTION: ${question}\n\nFACT-CHECKED CLAIMS:\n${claimBlock}\n\nSOURCES (for citation ids only):\n${sourceBlock}`,
    temperature: 0.4,
  })
}
