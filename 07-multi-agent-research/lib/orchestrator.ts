import { factCheck } from "@/lib/agents/factChecker"
import { planQueries, runSearch } from "@/lib/agents/search"
import { summarizeSources } from "@/lib/agents/summarizer"
import { writeReport } from "@/lib/agents/writer"
import type { PipelineEvent, ResearchReport } from "@/lib/types"

/**
 * ORCHESTRATOR
 * Runs the four agents in sequence and emits progress events after each
 * stage so the UI can render a live pipeline timeline:
 *
 *   Search (plan queries -> web search -> dedupe/rank)
 *     -> Summarizer (parallel per-source key facts + quality grades)
 *     -> Fact-Checker (claim extraction + cross-checking + deterministic confidence)
 *     -> Writer (cited Markdown brief from vetted claims only)
 */
export async function runResearch(
  question: string,
  emit: (event: PipelineEvent) => void,
): Promise<void> {
  const started = Date.now()

  // --- 1. SEARCH AGENT ---
  emit({ type: "stage", agent: "search", status: "started", detail: "Planning search queries…" })
  const queries = await planQueries(question)
  emit({ type: "queries", queries })
  const sources = await runSearch(queries)
  emit({
    type: "sources",
    sources: sources.map((s) => ({ id: s.id, title: s.title, url: s.url })),
  })
  emit({
    type: "stage",
    agent: "search",
    status: "done",
    detail: `${queries.length} queries → ${sources.length} unique sources`,
  })

  // --- 2. SUMMARIZER AGENT ---
  emit({ type: "stage", agent: "summarizer", status: "started", detail: `Summarizing ${sources.length} sources in parallel…` })
  const summaries = await summarizeSources(sources)
  const high = summaries.filter((s) => s.sourceQuality === "high").length
  emit({
    type: "stage",
    agent: "summarizer",
    status: "done",
    detail: `${summaries.reduce((n, s) => n + s.keyFacts.length, 0)} key facts extracted (${high} high-quality sources)`,
  })

  // --- 3. FACT-CHECKER AGENT ---
  emit({ type: "stage", agent: "factChecker", status: "started", detail: "Extracting and cross-checking claims…" })
  const claims = await factCheck(question, sources, summaries)
  const supported = claims.filter((c) => c.verdict === "supported").length
  const contradicted = claims.filter((c) => c.verdict === "contradicted").length
  emit({
    type: "stage",
    agent: "factChecker",
    status: "done",
    detail: `${claims.length} claims checked — ${supported} supported, ${contradicted} contradicted`,
  })

  // --- 4. WRITER AGENT ---
  emit({ type: "stage", agent: "writer", status: "started", detail: "Composing cited report…" })
  const markdown = await writeReport(question, claims, sources)
  emit({ type: "stage", agent: "writer", status: "done", detail: "Report ready" })

  const report: ResearchReport = {
    question,
    markdown,
    claims,
    sources,
    queries,
    elapsedMs: Date.now() - started,
  }
  emit({ type: "report", report })
}
