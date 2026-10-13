"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import type { AgentName, PipelineEvent, ResearchReport } from "@/lib/types"

const SAMPLE_QUESTIONS = [
  "Is intermittent fasting effective for weight loss?",
  "Do electric cars actually reduce lifetime carbon emissions?",
  "Is TypeScript worth the overhead for small teams?",
  "Does remote work reduce productivity?",
]

const AGENTS: { key: AgentName; icon: string; label: string; role: string }[] = [
  { key: "search", icon: "🔍", label: "Search agent", role: "Plans diverse queries, searches the web, dedupes sources" },
  { key: "summarizer", icon: "📝", label: "Summarizer agent", role: "Extracts key facts and grades source quality" },
  { key: "factChecker", icon: "⚖️", label: "Fact-checker agent", role: "Cross-checks claims across all sources" },
  { key: "writer", icon: "✍️", label: "Writer agent", role: "Composes the cited report from vetted claims" },
]

type StageState = { status: "idle" | "running" | "done"; detail: string }

function confColor(c: number): string {
  if (c >= 70) return "#34c77b"
  if (c >= 40) return "#f0b429"
  return "#f2555a"
}

export default function Home() {
  const [question, setQuestion] = useState("")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stages, setStages] = useState<Record<AgentName, StageState>>({
    search: { status: "idle", detail: "" },
    summarizer: { status: "idle", detail: "" },
    factChecker: { status: "idle", detail: "" },
    writer: { status: "idle", detail: "" },
  })
  const [report, setReport] = useState<ResearchReport | null>(null)

  async function research(q?: string) {
    const text = (q ?? question).trim()
    if (!text || running) return
    setRunning(true)
    setError(null)
    setReport(null)
    setStages({
      search: { status: "idle", detail: "" },
      summarizer: { status: "idle", detail: "" },
      factChecker: { status: "idle", detail: "" },
      writer: { status: "idle", detail: "" },
    })
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status}).`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as PipelineEvent
          if (event.type === "stage") {
            setStages((prev) => ({
              ...prev,
              [event.agent]: {
                status: event.status === "started" ? "running" : "done",
                detail: event.detail,
              },
            }))
          } else if (event.type === "report") {
            setReport(event.report)
          } else if (event.type === "error") {
            setError(event.message)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed.")
    } finally {
      setRunning(false)
    }
  }

  const anyStageActive = Object.values(stages).some((s) => s.status !== "idle")

  return (
    <main className="container">
      <div className="hero">
        <h1>🧠 Multi-Agent Research Assistant</h1>
        <p>
          Four specialized agents — Search, Summarizer, Fact-Checker, and Writer —
          collaborate to answer your question with cited sources and honest,
          per-claim confidence scores.
        </p>
      </div>

      <div className="ask-card">
        <div className="ask-row">
          <input
            value={question}
            placeholder="e.g. Do electric cars actually reduce lifetime carbon emissions?"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && research()}
          />
          <button onClick={() => research()} disabled={running}>
            {running ? "Researching…" : "Research"}
          </button>
        </div>
        <div className="chips">
          {SAMPLE_QUESTIONS.map((q) => (
            <button key={q} onClick={() => { setQuestion(q); void research(q) }}>
              {q}
            </button>
          ))}
        </div>
        {error && <div className="error-box">⛔ {error}</div>}
      </div>

      {anyStageActive && (
        <div className="timeline">
          {AGENTS.map((agent) => {
            const s = stages[agent.key]
            return (
              <div key={agent.key} className={`stage ${s.status === "running" ? "running" : s.status === "done" ? "done" : ""}`}>
                <div className="rail">
                  <div className="dot">{s.status === "done" ? "✅" : agent.icon}</div>
                  <div className="line" />
                </div>
                <div className="body">
                  <div className="name">{agent.label}</div>
                  <div className="detail">{s.detail || (s.status === "idle" ? agent.role : "")}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {report && (
        <>
          <div className="card">
            <h2>{report.question}</h2>
            <p className="meta">
              {report.sources.length} sources · {report.claims.length} fact-checked claims · {(report.elapsedMs / 1000).toFixed(1)}s
            </p>
            <div className="report">
              <ReactMarkdown>{report.markdown}</ReactMarkdown>
            </div>
          </div>

          <div className="card">
            <h2>⚖️ Claim confidence</h2>
            <table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Verdict</th>
                  <th>Confidence</th>
                  <th>Sources</th>
                </tr>
              </thead>
              <tbody>
                {report.claims.map((c, i) => (
                  <tr key={i}>
                    <td>
                      {c.text}
                      {c.note && <div className="meta">{c.note}</div>}
                    </td>
                    <td>
                      <span className={`verdict ${c.verdict}`}>{c.verdict.replace("_", " ")}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="conf-bar">
                        <div style={{ width: `${c.confidence}%`, background: confColor(c.confidence) }} />
                      </span>
                      {c.confidence}%
                    </td>
                    <td>
                      {c.supportedBy.map((id) => `[${id}]`).join(" ")}
                      {c.contradictedBy.length > 0 && (
                        <span style={{ color: "#f2555a" }}> vs {c.contradictedBy.map((id) => `[${id}]`).join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card sources">
            <h2>📚 Sources</h2>
            <ul style={{ marginLeft: 20 }}>
              {report.sources.map((s) => (
                <li key={s.id}>
                  [{s.id}]{" "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>{" "}
                  <span className="found-by">— found by “{s.foundBy}”</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  )
}
