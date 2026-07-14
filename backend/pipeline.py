import os
import json
import random
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-5.4-mini"   # one place to swap models later

def _discover_once(comments, n_themes=6):
    """One discovery pass over one sample"""
    sample = "\n".join(f"- {c}" for c in comments)
    prompt = (
        f"Here are open-ended feedback comments:\n\n{sample}\n\n"
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

def discover_themes(comments, n_themes=6, n_samples=3, sample_size=150, seed=42):
    """Pass 1: discover themes from several random samples, then merge.

    Themes that recur across independent samples are more likely to represent
    genuine patterns, while themes appearing only once are treated as sample noise.
    """

    rng = random.Random(seed)

    # If there are not many comments, one pass over everything is enough
    if len(comments) <= sample_size:
        return _discover_once(comments, n_themes)

    # Run theme discovery on n_samples independently sampled subsets
    all_lists = []
    for _ in range(n_samples):
        subset = rng.sample(comments, sample_size)
        all_lists.append(_discover_once(subset, n_themes))

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
        temperature=0, # make it as consistent as possible
    )
    text = resp.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)

def classify_comment(comment, themes):
    """Pass 2: assign a primary theme (+ optional secondary themes), sentiment, confidence."""
    theme_list = ", ".join(f'"{t}"' for t in themes)
    prompt = (
        f"Themes: [{theme_list}]\n\n"
        f'Comment: "{comment}"\n\n'
        "The comment may contain extra appended fields such as dates, IDs, or "
        "ratings from a malformed file; focus only on the human-written feedback. "
        "Assign the single BEST-fitting theme as \"primary_theme\" "
        "(pick the closest; if truly none fit, use \"Other\"). "
        "If the comment clearly raises other distinct themes from the list, list them "
        "in \"secondary_themes\" (max 2); otherwise use an empty array. "
        "Also label sentiment as \"positive\", \"negative\", or \"neutral\". "
        "Also give your confidence in the primary theme from 0.0 to 1.0. "
        "Return ONLY JSON like: {\"primary_theme\": \"...\", "
        "\"secondary_themes\": [\"...\"], \"sentiment\": \"...\", \"confidence\": 0.0}"
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    text = resp.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    result = json.loads(text)

    # Guard: coerce confidence to a float in [0, 1], default 0.5 if missing or invalid
    try:
        c = float(result.get("confidence", 0.5))
        result["confidence"] = max(0.0, min(1.0, c))
    except (TypeError, ValueError):
        result["confidence"] = 0.5
    sec = result.get("secondary_themes") or []
    if isinstance(sec, str):
        sec = [sec]
    result["secondary_themes"] = [s for s in sec if s != result.get("primary_theme")][:2]
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
        print(f'[{result["theme"]}] ({result["sentiment"]}) {c}')
