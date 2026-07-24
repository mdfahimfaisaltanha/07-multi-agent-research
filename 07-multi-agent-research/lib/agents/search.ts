import { chatJson } from "@/lib/llm"
import type { Source } from "@/lib/types"

/**
 * SEARCH AGENT
 * 1. Plans 3-5 diverse search queries from the research question (angles,
 *    counter-evidence, recency).
 * 2. Runs them against the Tavily search API in parallel.
 * 3. Dedupes by URL and keeps the top sources by relevance score.
 */

const PLAN_SYSTEM = `You are a research query planner. Given a research question, produce 3-5 diverse web search queries that together cover:
- the core question itself
- at least one alternative angle or competing viewpoint
- counter-evidence (add words like "criticism", "limitations", "debunked" where relevant)
- recent developments (add the current year where freshness matters)
Return JSON: {"queries": ["..."]}. Queries must be short (3-9 words), concrete, and non-redundant.`

function validateQueries(data: unknown): string[] | null {
  if (typeof data !== "object" || data === null) return null
  const q = (data as Record<string, unknown>).queries
  if (!Array.isArray(q)) return null
  const out = q.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim())
  return out.length >= 2 ? out.slice(0, 5) : null
}

export async function planQueries(question: string): Promise<string[]> {
  return chatJson<string[]>({
    system: PLAN_SYSTEM,
    user: `Research question: ${question}\nCurrent date: ${new Date().toISOString().slice(0, 10)}`,
    validate: validateQueries,
  })
}

type TavilyResult = {
  title?: string
  url?: string
  content?: string
  score?: number
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  })
  if (!res.ok) {
    // Rate limits / auth errors: surface a readable message, don't crash the pipeline
    const body = await res.text().catch(() => "")
    throw new Error(`Search API error ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { results?: TavilyResult[] }
  return data.results ?? []
}

export async function runSearch(queries: string[]): Promise<Source[]> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set. Copy .env.example to .env.local and add your key (free tier at tavily.com).")
  }

  // Run all queries in parallel; tolerate individual query failures so one
  // rate-limited call doesn't kill the whole run.
  const settled = await Promise.allSettled(queries.map((q) => tavilySearch(q)))

  const seen = new Set<string>()
  const sources: Source[] = []
  let failures = 0

  settled.forEach((result, i) => {
    if (result.status === "rejected") {
      failures++
      return
    }
    for (const r of result.value) {
      if (!r.url || !r.content || seen.has(r.url)) continue
      seen.add(r.url)
      sources.push({
        id: sources.length + 1,
        title: r.title || r.url,
        url: r.url,
        content: r.content.slice(0, 2500),
        foundBy: queries[i],
        score: r.score ?? 0,
      })
    }
  })

  if (sources.length === 0) {
    if (failures === settled.length) {
      throw new Error("All search queries failed — check your TAVILY_API_KEY and rate limits.")
    }
    throw new Error("No sources found for this question. Try rephrasing it or making it more specific.")
  }

  // Keep the strongest 10 sources to bound cost and latency.
  return sources
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s, i) => ({ ...s, id: i + 1 }))
}
