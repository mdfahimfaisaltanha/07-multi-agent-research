# Sample output

**Question:** *Do electric cars actually reduce lifetime carbon emissions?*

Below is a representative run (abbreviated). Your results will vary with live search results.

---

## Pipeline trace

| Agent | Result |
|---|---|
| 🔍 Search | 4 queries → 9 unique sources (e.g. “electric car lifetime emissions study”, “EV battery manufacturing emissions criticism”, “EV vs gasoline lifecycle analysis 2026”) |
| 📝 Summarizer | 31 key facts extracted (4 high-quality sources) |
| ⚖️ Fact-checker | 7 claims checked — 4 supported, 1 partially supported, 1 contradicted, 1 unverified |
| ✍️ Writer | Report ready in 28.4s |

---

## Answer

Across lifecycle analyses, battery-electric vehicles produce substantially lower total greenhouse-gas emissions than comparable gasoline cars over their lifetime, even after accounting for battery manufacturing [1][3][5]. Manufacturing an EV — particularly its battery — does emit more CO₂ up front than building a gasoline car [2][3]; however, evidence indicates the EV typically overtakes the gasoline car within roughly 1–2 years of average driving as its per-mile emissions advantage compounds [1][5].

The size of the advantage depends heavily on the electricity grid: on coal-heavy grids the lifetime benefit narrows considerably, though most analyses still find EVs ahead [3][4]. Evidence suggests grid decarbonization is widening the gap each year [5].

## Key findings

- EVs emit significantly less CO₂ over their lifetime than gasoline cars in most markets — **confidence 92%** [1][3][5]
- Battery manufacturing makes EV production more carbon-intensive up front — **confidence 87%** [2][3]
- The manufacturing “carbon debt” is typically repaid within 1–2 years of driving — **confidence 74%** [1][5]
- Grid mix materially affects the size of the benefit — **confidence 81%** [3][4]

## Disputed & unverified

- “EVs are worse for the climate on coal-heavy grids” — **contradicted (28%)**: one opinion source asserts this [6], but two lifecycle studies find EVs still ahead even on coal-heavy grids [3][4].
- “EV batteries last 20+ years on average” — **unverified (18%)**: no examined source provided direct evidence.

---

## Claim confidence table (as shown in the UI)

| Claim | Verdict | Confidence | Sources |
|---|---|---|---|
| EVs emit less CO₂ lifetime than gasoline cars | supported | 92% | [1][3][5] |
| EV production is more carbon-intensive up front | supported | 87% | [2][3] |
| Grid mix affects the benefit size | supported | 81% | [3][4] |
| Carbon debt repaid in 1–2 years | partially supported | 74% | [1][5] |
| EVs worse on coal-heavy grids | contradicted | 28% | [6] vs [3][4] |
| Batteries last 20+ years | unverified | 18% | — |

*Note how the deterministic confidence model separates well-supported claims (multiple independent, high-quality sources) from single-source and contradicted ones — the LLM never picks these numbers itself.*
