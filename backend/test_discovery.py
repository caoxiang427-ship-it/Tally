import pandas as pd
from pipeline import discover_themes

df = pd.read_csv("data/eval_set.csv")
comments = df["text"].tolist()

themes = discover_themes(comments)
print(f"Discovered themes from {len(comments)} real complaints:")
for t in themes:
    print(" -", t)
