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

@app.post("/analyze")
async def analyze(file: UploadFile = File(...), column: str = "text"):
    raw = await file.read()
    dataframe = pd.read_csv(io.BytesIO(raw))
    comments = dataframe[column].dropna().astype(str).tolist()

    themes = discover_themes(comments)

    results = []
    for c in comments:
        r = classify_comment(c, themes)
        results.append({"comment": c, "theme": r["theme"], "sentiment": r["sentiment"]})

    theme_counts = Counter(r["theme"] for r in results)
    sentiment_counts = Counter(r["sentiment"] for r in results)

    examples = {}
    for r in results:
        examples.setdefault(r["theme"], [])
        if len(examples[r["theme"]]) < 2:
            examples[r["theme"]].append(r["comment"])

    return {
        "total": len(results),
        "themes": themes,
        "theme_counts": dict(theme_counts),
        "sentiment_counts": dict(sentiment_counts),
        "examples": examples,
        "results": results,
    }
