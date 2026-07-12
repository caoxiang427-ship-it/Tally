import io
import pandas as pd
from collections import Counter
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pipeline import discover_themes, classify_comment

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# below this, or "Other" catgeory, flag for review
REVIEW_THRESHOLD = 0.6 

@app.post("/analyze")
async def analyze(file: UploadFile = File(...), column: str = "text"):
    raw = await file.read()
    dataframe = pd.read_csv(io.BytesIO(raw))
    comments = dataframe[column].dropna().astype(str).tolist()

    themes = discover_themes(comments)

    results = []
    for c in comments:
        r = classify_comment(c, themes)
        conf = r.get("confidence", 0.5)
        results.append({
            "comment": c,
            "theme": r["theme"],
            "sentiment": r["sentiment"],
            "confidence": conf,
            "needs_review": conf < REVIEW_THRESHOLD or r["theme"] == "Other",
        })

    # Make zero-count themes visible
    theme_counts = {t: 0 for t in themes}
    for r in results:
        theme_counts[r["theme"]] = theme_counts.get(r["theme"], 0) + 1

    sentiment_counts = Counter(r["sentiment"] for r in results)

    examples = {}
    for r in results:
        examples.setdefault(r["theme"], [])
        if len(examples[r["theme"]]) < 2:
            examples[r["theme"]].append(r["comment"])

    review_count = sum(1 for r in results if r["needs_review"])
    return {
        "total": len(results),
        "themes": themes,
        "theme_counts": dict(theme_counts),
        "sentiment_counts": dict(sentiment_counts),
        "examples": examples,
        "results": results,
        "review_count": review_count,
    }
