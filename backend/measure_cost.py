import time
import json
import pandas as pd
from pipeline import client, MODEL

CATEGORIES = [
    "Credit reporting, credit repair services, or other personal consumer reports",
    "Debt collection", "Mortgage", "Credit card or prepaid card",
    "Checking or savings account", "Student loan",
]

# OpenAI API pricing (USD per 1M text tokens, July 2026)
PRICES = {
    "gpt-5.4-mini": {"in": 0.75, "out": 4.50},
    "gpt-5.4":      {"in": 2.50, "out": 15.00},
}

def classify_measured(comment, themes, model):
    theme_list = ", ".join(f'"{t}"' for t in themes)
    prompt = (
        f"Themes: [{theme_list}]\n\n"
        f'Comment: "{comment}"\n\n'
        "Assign this comment to exactly ONE theme from the list above "
        "(pick the closest; if truly none fit, use \"Other\"). "
        "Also label sentiment as \"positive\", \"negative\", or \"neutral\". "
        "Return ONLY JSON like: {\"theme\": \"...\", \"sentiment\": \"...\"}"
    )
    t0 = time.time()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    latency = time.time() - t0
    u = resp.usage
    return latency, u.prompt_tokens, u.completion_tokens


def run(model, n=60):
    df = pd.read_csv("data/eval_set.csv").sample(n=n, random_state=42)
    lat, tin, tout = [], [], []
    for text in df["text"]:
        l, i, o = classify_measured(text, CATEGORIES, model)
        lat.append(l); tin.append(i); tout.append(o)

    avg_in, avg_out = sum(tin)/n, sum(tout)/n
    p = PRICES[model]
    cost_per_1k = (avg_in * p["in"] + avg_out * p["out"]) / 1000  # $ per 1000 comments

    lat_sorted = sorted(lat)
    median_lat = lat_sorted[len(lat_sorted)//2]

    print(f"\n=== {model} (n={n}) ===")
    print(f"Avg tokens: {avg_in:.0f} in / {avg_out:.0f} out")
    print(f"Cost per 1,000 comments: ${cost_per_1k:.2f}")
    print(f"Median latency/comment: {median_lat:.2f}s")
    print(f"Est. time for 1,000 (sequential): {sum(lat)/n*1000/60:.1f} min")
    return cost_per_1k, median_lat


if __name__ == "__main__":
    run("gpt-5.4-mini")
    run("gpt-5.4")   # frontier comparison
