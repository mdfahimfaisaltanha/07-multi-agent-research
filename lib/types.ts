/** Shared types for the multi-agent research pipeline. */

export type Source = {
  /** 1-based citation id used in the report as [n]. */
  id: number
  title: string
  url: string
  /** Raw content snippet returned by search. */
  content: string
  /** Which generated query found this source. */
  foundBy: string
  score: number
}

export type SourceSummary = {
  sourceId: number
  /** 3-5 bullet key facts extracted from the source, verbatim-faithful. */
  keyFacts: string[]
  /** low | medium | high — the Summarizer's judgment of source quality. */
  sourceQuality: "low" | "medium" | "high"
  qualityReason: string
}

export type ClaimVerdict = "supported" | "partially_supported" | "contradicted" | "unverified"

export type Claim = {
  text: string
  verdict: ClaimVerdict
  /** 0-100. Derived from independent source support + agreement (see README). */
  confidence: number
  /** Source ids that support the claim. */
  supportedBy: number[]
  /** Source ids that contradict the claim. */
  contradictedBy: number[]
  note: string
}

export type ResearchReport = {
  question: string
  markdown: string
  claims: Claim[]
  sources: Source[]
  queries: string[]
  elapsedMs: number
}

/** Server-sent pipeline events streamed to the UI. */
export type PipelineEvent =
  | { type: "stage"; agent: AgentName; status: "started" | "done"; detail: string }
  | { type: "queries"; queries: string[] }
  | { type: "sources"; sources: Pick<Source, "id" | "title" | "url">[] }
  | { type: "report"; report: ResearchReport }
  | { type: "error"; message: string }

export type AgentName = "search" | "summarizer" | "factChecker" | "writer"
