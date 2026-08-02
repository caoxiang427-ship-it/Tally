# Tally

**Structured analysis of unlabelled open-ended feedback.**

Tally discovers themes in a pile of open-ended comments (survey responses, reviews, complaints), classifies every comment by theme and sentiment, and turns unstructured text into countable, reproducible results — no labelled training data required.

Built for the case where manual review doesn't scale and a general chatbot skims: hundreds to thousands of unlabelled comments where the categories aren't known in advance, but the results still need to be structured, countable, and consistent enough to report.

---

## What it does

- **Discovers themes** from raw text — no labels or setup (multi-sample discovery + merge for consistency).
- **Classifies every comment** — primary theme, optional secondary themes, sentiment, and a confidence/fit score.
- **Flags uncertain cases** for human review, where they can be corrected or excluded (changes flow into the export).
- **Filters and searches** — narrow comments by theme, sentiment, or keyword to explore the results interactively.
- **Breaks results down by segment** (e.g. rating, region) with lift and a chi-square test for significance.
- **Compares feedback over time** — theme share by period, two-proportion significance tests, and z-score anomaly detection.
- **Exports** a fully classified, auditable CSV.

---

## Evidence

Evaluated on 360 CFPB complaints (6 balanced categories, fixed seed, temperature 0), with success criteria pre-registered before evaluation.

| Method | Macro-F1 | Cohen's κ |
|---|---|---|
| Keyword baseline | 0.541 | 0.420 |
| TF-IDF + LogReg (trained on 360 labels) | 0.779 | 0.737 |
| **Tally (LLM, zero training)** | **0.736** | **0.827** |

Competitive with a trained baseline **without any labelled training data** — higher κ, slightly lower Macro-F1. Runs at ~$0.38 per 1,000 comments. See `backend/RESULTS.md` for full methodology and `WRITEUP.md` for the complete write-up.

---

## Live demo

**[https://tally-indol.vercel.app]**

## Running it locally

**Requirements:** Python 3.12, Node.js, an OpenAI API key.

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "OPENAI_API_KEY=your-key-here" > .env
uvicorn api:app --reload --port 8000
```

### Frontend
```bash
npm install
npm run dev
```
Open the URL Vite prints (default `http://localhost:5173`). Upload a CSV with a free-text column.

---

## Reproducing the evaluation

```bash
cd backend
source venv/bin/activate
python build_eval_set.py      # builds the 360-complaint eval set (SEED=42)
python baselines.py           # keyword + TF-IDF baselines
python run_llm.py             # Tally classifications
python evaluate.py            # Macro-F1, Cohen's κ
python verify_stats.py        # verifies hand-rolled stats against SciPy
```

---

## Repository guide

- `backend/pipeline.py` — the two-pass theme-discovery and classification pipeline (the core method).
- `backend/api.py` — FastAPI endpoints, robust CSV parsing, parallel classification, and the statistical tests.
- `backend/SUCCESS_CRITERIA.md` — success criteria, pre-registered (git-timestamped) before evaluation.
- `backend/RESULTS.md` — evaluation methodology and measured results.
- `backend/STATS_VERIFICATION.md` — hand-implemented statistics verified against SciPy.
- `src/App.jsx` — dashboard, review queue, segment analysis, and trend analysis.
- `LIMITATIONS.md` — known limitations and next steps.
- `failures.md` — running log of issues found and how they were handled.
- `WRITEUP.md` — the five-pillar write-up.

---

## Limitations

Tally analyses one text column and one segmentation dimension at a time. User corrections are session-only. Sentiment is illustrative, not evaluated. Trend analysis compares uploaded datasets rather than continuously monitoring. See `LIMITATIONS.md` for the full list and planned next steps.
