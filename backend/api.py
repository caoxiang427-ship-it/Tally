import pandas as pd
import json
import re
from fastapi.responses import StreamingResponse
from collections import Counter
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pipeline import discover_themes, classify_comment
from concurrent.futures import ThreadPoolExecutor
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# below this, or "Other" category, flag for review
REVIEW_THRESHOLD = 0.6 

def pick_text_column(df):
    """Pick the most likely text column from a dataframe."""
    # 1. Prefer columns with common comment-like names
    preferred = ["text", "comment", "comments", "feedback", "review",
                "response", "narrative", "message", "answer"]
    lower = {c.lower(): c for c in df.columns}

    for name in preferred:
        if name in lower:
            return lower[name]

    # 2. Otherwise, pick the column with the longest average text
    text_cols = df.select_dtypes(include="object").columns # give all cols that contain text, not numbers
    
    if len(text_cols) == 0:
        raise ValueError("No text columns found in CSV.")
   
    avg_lengths = {c: df[c].dropna().astype(str).str.len().mean() for c in text_cols}
    return max(avg_lengths, key=avg_lengths.get)


def read_csv_robust(raw):
    """Try multiple strategies to read a messy CSV/Excel file"""
    import io

    # Layer 1: Standard CSV (handles properly quoted commas)
    try:
        return pd.read_csv(io.BytesIO(raw)), True
    except Exception:
        pass

    # Layer 1b: auto-detect tab, semicolon, pipe...
    try:
        return pd.read_csv(io.BytesIO(raw), sep=None, engine="python"), True
    except Exception:
        pass

    # Layer 1c: Excel
    try:
        return pd.read_excel(io.BytesIO(raw)), True
    except Exception:
        pass

    # Layer 2: one comment per line
    text = raw.decode("utf-8", errors="ignore")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    
    if lines and len(lines[0]) < 40 and " " not in lines[0]:
        lines = lines[1:]   # drop a header-looking first line

    import re
    lines = [re.sub(r'^(\s*\d+\s*,\s*)+', '', l) for l in lines]
    
    return pd.DataFrame({"text": lines}), False

def parse_period(filename, idx):
    """'01_jan.csv' -> (1, 'jan'). Falls back to upload order"""
    base = filename.rsplit(".", 1)[0]
    m = re.match(r"^(\d+)[_\-\s]*(.*)$", base)
    if m:
        return int(m.group(1)), (m.group(2).strip() or base)
    return idx, base

@app.post("/analyze")
async def analyze(file: UploadFile = File(...), column: str = "text"):
    raw = await file.read()

    dataframe, parsed_cleanly = read_csv_robust(raw)
    if dataframe is None or len(dataframe) == 0:
        return {"error": "Could not read this file. Please upload a CSV or Excel file."}
    
    # Pick the text column: use the one requested, else auto-detect 
    # Check if the user actually provided column name & if that column actually exists in CSV
    try:
        text_col = pick_text_column(dataframe) if not (column and column in dataframe.columns) else column
    except ValueError as e:
        return {"error": str(e)}

    comments = dataframe[text_col].dropna().astype(str).tolist()

    if len(comments) == 0:
        return {"error": "No comments found. The file appears to be empty or has no text in the detected column."}

    n = max(3, min(6, len(comments) // 2)) # scale theme count to data size
    themes = discover_themes(comments, n_themes=n)

    def classify_one(c):
        r = classify_comment(c, themes)
        conf = r.get("confidence", 0.5)
        primary = r.get("primary_theme", r.get("theme", "Other"))
        return {
            "comment": c,
            "theme": primary,
            "secondary_themes": r.get("secondary_themes", []),
            "sentiment": r["sentiment"],
            "confidence": conf,
            "needs_review": conf < REVIEW_THRESHOLD or primary == "Other",
        }

    # Run up to 10 classifications concurrently, preserving input order
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(classify_one, comments))

    # Primary counts (each comment counts once), drives the chart, sums to N
    theme_counts = {t: 0 for t in themes}
    for r in results:
        theme_counts[r["theme"]] = theme_counts.get(r["theme"], 0) + 1
    
    # Mention counts (primary + secondary), counts each mention, sums to > N
    mention_counts = {t: 0 for t in themes}
    for r in results:
        for t in [r["theme"]] + r.get("secondary_themes", []):
            mention_counts[t] = mention_counts.get(t, 0) + 1

    sentiment_counts = Counter(r["sentiment"] for r in results)

    examples = {}
    for r in results:
        examples.setdefault(r["theme"], [])
        if len(examples[r["theme"]]) < 2:
            examples[r["theme"]].append(r["comment"])

    review_count = sum(1 for r in results if r["needs_review"])
    return {
        "total": len(results),
        "text_column": text_col,
        "clean_parse": parsed_cleanly,
        "themes": themes,
        "theme_counts": dict(theme_counts),
        "mention_counts": dict(mention_counts),
        "sentiment_counts": dict(sentiment_counts),
        "examples": examples,
        "results": results,
        "review_count": review_count,
    }

@app.post("/analyze_stream")
async def analyze_stream(file: UploadFile = File(...), column: str = None):
    raw = await file.read()

    dataframe, parsed_cleanly = read_csv_robust(raw)
    if dataframe is None or len(dataframe) == 0:
        return {"error": "Could not read this file. Please upload a CSV or Excel file."}

    try:
        text_col = pick_text_column(dataframe) if not (column and column in dataframe.columns) else column
    except ValueError as e:
        return {"error": str(e)}

    comments = dataframe[text_col].dropna().astype(str).tolist()

    if len(comments) == 0:
        return {"error": "No comments found. The file appears to be empty or has no text in the detected column."}

    def event_stream():
        # 1. Discover themes (once)
        n = max(2, min(6, len(comments) // 3)) # scale theme count to data size
        themes = discover_themes(comments, n_themes=n)

        yield sse({"type": "themes", "themes": themes,
                   "total": len(comments), "text_column": text_col,
                   "clean_parse": parsed_cleanly})

        # 2. Classify each comment & stream progress updates
        results = []
        for i, c in enumerate(comments):
            r = classify_comment(c, themes)
            conf = r.get("confidence", 0.5)
            row = {
                "comment": c,
                "theme": r["theme"],
                "sentiment": r["sentiment"],
                "confidence": conf,
                "needs_review": conf < REVIEW_THRESHOLD or r["theme"] == "Other",
            }
            results.append(row)
            yield sse({"type": "progress", "done": i + 1, "total": len(comments), "row": row})

        # 3. Final aggregates
        theme_counts = {t: 0 for t in themes}
        for r in results:
            theme_counts[r["theme"]] = theme_counts.get(r["theme"], 0) + 1
        sentiment_counts = dict(Counter(r["sentiment"] for r in results))
        review_count = sum(1 for r in results if r["needs_review"])

        yield sse({"type": "done",
                   "total": len(results),
                   "text_column": text_col,
                   "clean_parse": parsed_cleanly,
                   "themes": themes,
                   "theme_counts": theme_counts,
                   "sentiment_counts": sentiment_counts,
                   "results": results,
                   "review_count": review_count})

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/analyze_trend")
async def analyze_trend(files: List[UploadFile] = File(...)):
    if len(files) < 2:
        return {"error": "Upload at least two files to compare periods."}

    # 1. Read every file into a period
    periods = []
    for idx, f in enumerate(files):
        raw = await f.read()
        df, clean = read_csv_robust(raw)

        if df is None or len(df) == 0:
            return {"error": f"Could not read '{f.filename}'."}
        
        try:
            text_col = pick_text_column(df)
        except ValueError:
            return {"error": f"No text column found in '{f.filename}'."}
        
        comments = df[text_col].dropna().astype(str).tolist()
        if not comments:
            return {"error": f"No comments found in '{f.filename}'."}
        
        order, name = parse_period(f.filename, idx)
        periods.append({"order": order, "name": name, "comments": comments,
                        "clean_parse": clean})

    periods.sort(key=lambda p: p["order"])

    # 2. ONE shared theme list, discovered from a pooled sample across all periods
    per_file = max(10, 150 // len(periods))
    pooled = []
    for p in periods:
        pooled.extend(p["comments"][:per_file])
    n = max(3, min(6, len(pooled) // 3))
    themes = discover_themes(pooled, n_themes=n)

    # 3. Classify every period against that same fixed list
    def classify_one(c):
        r = classify_comment(c, themes)
        return {
            "theme": r.get("primary_theme", r.get("theme", "Other")),
            "sentiment": r["sentiment"],
        }
    
    out_periods = []
    for p in periods:
        with ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(classify_one, p["comments"]))

        total = len(results)
        counts = {t: 0 for t in themes}
        for r in results:
            counts[r["theme"]] = counts.get(r["theme"], 0) + 1
        shares = {t: round(c / total * 100, 1) for t, c in counts.items()}

        sent = {"negative": 0, "positive": 0, "neutral": 0}
        for r in results:
            sent[r["sentiment"]] = sent.get(r["sentiment"], 0) + 1

        out_periods.append({
            "name": p["name"],
            "order": p["order"],
            "total": total,
            "theme_counts": counts,
            "theme_shares": shares,
            "other_count": counts.get("Other", 0),
            "other_share": round(counts.get("Other", 0) / total * 100, 1),
            "sentiment_counts": sent,
            "sentiment_shares": {k: round(v / total * 100, 1) for k, v in sent.items()},
            "clean_parse": p["clean_parse"],
        })

    return {"themes": themes, "periods": out_periods}

def sse(obj):
    """Format a dict as one Server-Sent Event line."""
    return f"data: {json.dumps(obj)}\n\n"