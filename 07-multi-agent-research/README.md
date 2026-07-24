# Multi-Agent Research Assistant

Ask a research question → four specialized agents collaborate to produce a **cited Markdown brief** with **per-claim confidence scores**, streamed live to the UI as each agent works.

```
 ┌────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
 │  SEARCH  │ → │  SUMMARIZER  │ → │ FACT-CHECKER │ → │ WRITER │
 │ plan +   │   │ key facts +  │   │ claims +     │   │ cited  │
 │ web      │   │ quality      │   │ verdicts +   │   │ report │
 │ search   │   │ grades       │   │ confidence   │   │        │
 └────────────┘   └──────────────┘   └──────────────┘   └────────┘
```

Built with **Next.js 14 (App Router)**, **TypeScript**, the **OpenAI API**, and **Tavily** web search. Stateless — no database.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # set OPENAI_API_KEY + TAVILY_API_KEY (free tier: tavily.com)
npm run dev                  # http://localhost:3000
```

Click a sample question chip and watch the agent timeline run. A full example output is in `samples/sample-report.md`.

---

## The four agents

| Agent | File | Job |
|---|---|---|
| 🔍 **Search** | `lib/agents/search.ts` | Plans 3–5 diverse queries (core question, competing viewpoint, counter-evidence, recency), runs them in parallel against Tavily, dedupes by URL, keeps the top 10 by relevance |
| 📝 **Summarizer** | `lib/agents/summarizer.ts` | Extracts 3–5 verbatim-faithful key facts per source (parallel) and grades source quality (high/medium/low) with a stated reason |
| ⚖️ **Fact-Checker** | `lib/agents/factChecker.ts` | Extracts 5–10 candidate claims, cross-checks each against *all* source summaries, assigns verdicts and supporting/contradicting source ids |
| ✍️ **Writer** | `lib/agents/writer.ts` | Composes the final brief from **vetted claims only** — contradicted/unverified claims go in a dedicated “Disputed & unverified” section, never woven silently into the answer |

The orchestrator (`lib/orchestrator.ts`) runs them in sequence and streams NDJSON progress events (`app/api/research/route.ts`) so the UI renders a live pipeline timeline.

## Confidence methodology

A key design decision: **the LLM never picks the confidence number.** The Fact-Checker returns structured evidence (verdict + supporting/contradicting source ids), and the score is computed deterministically in code (`computeConfidence`):

```
base by verdict:      supported 55 · partially_supported 35 · contradicted 15 · unverified 10
+ source support:     +12 per independent supporting source (capped at +30)
+ source quality:     +5 per high-quality / +2.5 per medium-quality supporter (capped at +15)
− contradictions:     −20 per contradicting source
clamped to [5, 100]
```

Why this matters (interview talking point): LLM-generated confidence numbers are notoriously uncalibrated — models cluster around 70–90% regardless of evidence. Moving the arithmetic into code makes the score **reproducible, explainable, and tunable**, and the model is only asked to do what it's good at: reading and comparing text.

Additional honesty safeguards:
- Hallucinated source ids returned by the model are dropped before scoring.
- The Writer must use hedged language for partial support and cite `[n]` for every factual statement.
- Verdicts are instructed to be conservative: “when in doubt, downgrade.”

## Edge cases handled

| Case | Behavior |
|---|---|
| Conflicting sources | Claim marked `contradicted`, confidence penalized −20/source, disagreement shown in the claims table and “Disputed” section |
| Low-quality sources | Quality grades reduce the confidence bonus; the grade + reason is visible per source |
| No search results | Clean error suggesting a rephrase — no hallucinated report |
| Individual query fails (rate limit) | Other queries still proceed; total failure produces a clear API-key/rate-limit message |
| One source fails to summarize | Downgraded to a low-quality raw snippet instead of failing the run |
| Model returns malformed JSON | Validated + one self-correcting retry per agent call |
| Vague/short questions | 400 with guidance (min 8 chars); query planner adds angles for broad questions |

## Streaming design

The pipeline runs 20–40 seconds, so the API streams **newline-delimited JSON events** (`stage`, `queries`, `sources`, `report`, `error`) over a `ReadableStream`. The client reads with `fetch` + `getReader()` (not `EventSource`, which can't POST a body). Each stage flips the corresponding agent card from idle → running → done in the timeline.

## Deployment (Vercel)

1. Push this folder to GitHub → import in Vercel.
2. Set `OPENAI_API_KEY` and `TAVILY_API_KEY` in Project → Settings → Environment Variables.
3. Deploy. `maxDuration = 60` is set on the research route; the Hobby plan's 60s limit fits the default settings (10 sources, gpt-4o-mini).

## Limitations / roadmap

- Sources are search snippets (~2.5k chars), not full page fetches — a fetch-and-extract step per source is the natural next upgrade.
- Single-turn: no follow-up questions that reuse prior sources yet.
- English-optimized prompts.
- No persistence — adding a database for research history is straightforward if needed.
