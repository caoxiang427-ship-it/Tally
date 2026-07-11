import pandas as pd
from pipeline import classify_comment

CATEGORIES = [
    "Credit reporting, credit repair services, or other personal consumer reports",
    "Debt collection",
    "Mortgage",
    "Credit card or prepaid card",
    "Checking or savings account",
    "Student loan",
]

df = pd.read_csv("data/eval_set.csv")

preds = []
for i, text in enumerate(df["text"]):
    r = classify_comment(text, CATEGORIES)
    preds.append(r["theme"])

    if (i + 1) % 20 == 0:
        print(f"  {i+1}/{len(df)} done")

df["pred_llm"] = preds
df.to_csv("data/predictions_frontier.csv", index=False)
print(f"Saved {len(df)} LLM predictions.")

