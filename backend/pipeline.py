import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-5.4-mini"   # one place to swap models later


def discover_themes(comments, n_themes=6):
    """Pass 1: read a sample, return a fixed list of themes."""
    sample = "\n".join(f"- {c}" for c in comments)
    prompt = (
        f"Here are open-ended feedback comments:\n\n{sample}\n\n"
        f"Identify the {n_themes} most common recurring themes. "
        "Return ONLY a JSON array of short theme names (2-4 words each), "
        "no explanation. Example: [\"Slow delivery\", \"High price\"]"
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
