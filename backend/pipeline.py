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
    """Pass 2: assign one comment to a theme from the fixed list + sentiment."""
    theme_list = ", ".join(f'"{t}"' for t in themes)
    prompt = (
        f"Themes: [{theme_list}]\n\n"
        f'Comment: "{comment}"\n\n'
        "Assign this comment to exactly ONE theme from the list above "
        "(pick the closest; if truly none fit, use \"Other\"). "
        "Also label sentiment as \"positive\", \"negative\", or \"neutral\". "
        "Return ONLY JSON like: {\"theme\": \"...\", \"sentiment\": \"...\"}"
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    text = resp.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)

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
