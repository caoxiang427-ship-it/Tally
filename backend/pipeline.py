import os
import json
import random
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# One place to swap models later.
MODEL = "gpt-5.4-mini"

def _discover_once(comments, n_themes=6, context=None):
    """One discovery pass over one sample"""
    sample = "\n".join(f"- {c}" for c in comments)
    context_line = (
        f"These comments are feedback about: {context}. "
        "Choose themes relevant to that domain.\n\n"
        if context else ""
    )
    prompt = (
        f"Here are open-ended feedback comments:\n\n{sample}\n\n"
        f"{context_line}"
        "Some comments may contain extra appended fields such as dates, ID "
        "numbers, or ratings from a malformed file. Ignore those and focus only "
        "on the human-written feedback. Do NOT create themes about dates, "
        "numbers, or IDs.\n\n"
        f"Identify the {n_themes} most common recurring themes. "
        "Name each theme as a NEUTRAL TOPIC, not a problem "
        "(e.g. \"Delivery speed\", not \"Delivery issues\"; "
        "\"Pricing\", not \"High price\"), so that both positive and negative "
        "comments about the same topic share one theme. "
        "The themes must collectively cover the comments, including positive "
        "feedback and non-complaint topics. Do not produce only problem themes. "
        "Return ONLY a JSON array of short theme names (2-4 words each), "
        "no explanation. Example: [\"Delivery speed\", \"Pricing\"]"
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    text = resp.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)

def discover_themes(comments, n_themes=6, context=None, n_samples=3, sample_size=150, seed=42):
    """Pass 1: discover themes from several random samples, then merge.

    Themes that recur across independent samples are more likely to represent
    genuine patterns, while themes appearing only once are treated as sample noise.
    """

    rng = random.Random(seed)

    # If there are not many comments, one pass over everything is enough
    if len(comments) <= sample_size:
        return _discover_once(comments, n_themes, context)

    # Run theme discovery on n_samples independently sampled subsets
    all_lists = []
    for _ in range(n_samples):
        subset = rng.sample(comments, sample_size)
        all_lists.append(_discover_once(subset, n_themes, context))

    # Merge: ask the model to consolidate the lists into one
    shown = "\n".join(
        f"List {i+1}: {json.dumps(lst)}" for i, lst in enumerate(all_lists)
    )

    prompt = (
        f"{n_samples} independent analyses of the same feedback produced these theme lists:\n\n"
        f"{shown}\n\n"
        f"Merge them into ONE list of exactly {n_themes} themes. "
        "Combine themes that mean the same thing under a single clear name. "
        "Keep names as neutral topics, not problems. "
        "Prefer themes that appear in more than one list. "
        "Return ONLY a JSON array of theme names, no explanation. "
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,  # make it as consistent as possible
    )
    text = resp.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)

def classify_comment(comment, themes):
    """Pass 2: assign a primary theme (+ optional secondary themes), sentiment, confidence, fit."""
    theme_list = ", ".join(f'"{t}"' for t in themes)
    prompt = (
        f"Themes: [{theme_list}]\n\n"
        f'Comment: "{comment}"\n\n'
        "The comment may contain extra appended fields such as dates, IDs, or "
        "ratings from a malformed file; focus only on the human-written feedback. "
        "Assign the single best-fitting theme as \"primary_theme\". "
        "IMPORTANT: only assign a theme if the comment is genuinely and specifically "
        "about it. If the comment does not clearly match any listed theme — including "
        "vague, off-topic, test, or empty comments — you MUST use \"Other\" rather than "
        "forcing a weak match. Do not stretch a theme to fit. "
        "If you assign \"Other\", also provide \"suggested_theme\": a short (1-3 word) label "
        "for what this comment is actually about, even if it's not in the list. "
        "For non-Other comments, use an empty string."
        "If the comment clearly raises other distinct listed themes, list them in "
        "\"secondary_themes\" (max 2); otherwise use an empty array. "
        "Label sentiment as \"positive\", \"negative\", or \"neutral\". "
        "Give \"confidence\" (0.0-1.0): how sure you are of the primary theme among the options. "
        "Give \"fit\" (0.0-1.0): how well the comment actually matches that theme in absolute "
        "terms — a comment shoved into the closest-but-imperfect theme should score LOW fit "
        "even if confidence is high. "
        "Return ONLY JSON like: {\"primary_theme\": \"...\", "
        "\"secondary_themes\": [\"...\"], \"sentiment\": \"...\", "
        "\"confidence\": 0.0, \"fit\": 0.0}"
    )

    # Safe default so this function NEVER returns None, even on a bad model response
    default = {
        "primary_theme": "Other",
        "secondary_themes": [],
        "suggested_theme": "",
        "sentiment": "neutral",
        "confidence": 0.5,
        "fit": 0.5,
    }

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        text = resp.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
    except (json.JSONDecodeError, ValueError, KeyError, TypeError, AttributeError):
        return default

    if not isinstance(result, dict):
        return default

    # Field guards
    result["primary_theme"] = result.get("primary_theme") or "Other"

    s = str(result.get("sentiment", "")).lower()
    result["sentiment"] = s if s in ("positive", "negative", "neutral") else "neutral"

    sec = result.get("secondary_themes") or []
    if isinstance(sec, str):
        sec = [sec]
    result["secondary_themes"] = [s for s in sec if s != result["primary_theme"]][:2]

    for key in ("confidence", "fit"):
        try:
            v = float(result.get(key, 0.5))
            result[key] = max(0.0, min(1.0, v))
        except (TypeError, ValueError):
            result[key] = 0.5

    return result

def get_themes(comments, fixed_themes=None, n_themes=6):
    """Use a fixed category list if given (for evaluation);
    otherwise discover themes (for the live product)."""
    if fixed_themes is not None:
        return fixed_themes
    return discover_themes(comments, n_themes)

if __name__ == "__main__":
    with open("sample_comments.txt") as f:
        comments = [line.strip() for line in f if line.strip()]

    # Pass 1:
    themes = discover_themes(comments)
    print("Discovered themes:")
    for t in themes:
        print(" -", t)

    # Pass 2:
    print("\nClassifications:")
    for c in comments:
        result = classify_comment(c, themes)
        # FIX: classify_comment returns "primary_theme", not "theme"
        print(f'[{result["primary_theme"]}] ({result["sentiment"]}, '
              f'conf {result["confidence"]:.2f} / fit {result["fit"]:.2f}) {c}')