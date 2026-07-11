import pandas as pd
from pipeline import classify_comment

CATEGORIES = [
    "Credit reporting, credit repair services, or other personal consumer reports",
    "Debt collection", "Mortgage", "Credit card or prepaid card",
    "Checking or savings account", "Student loan",
]

# Smaller subset, 3 full runs would be 3x the cost
df = pd.read_csv("data/eval_set.csv").sample(n=60, random_state=42)

runs = []
for run in range(3):
    print(f"Run {run+1}/3...")
    runs.append([classify_comment(t, CATEGORIES)["theme"] for t in df["text"]])

r1, r2, r3 = runs
identical = sum(1 for a, b, c in zip(r1, r2, r3) if a == b == c)

# Show the disagreements
print("\nDisagreements across runs:")
for i, (a, b, c) in enumerate(zip(r1, r2, r3)):
    if not (a == b == c):
        print(f"\nComment: {df['text'].iloc[i][:120]}...")
        print(f"  True label: {df['label'].iloc[i]}")
        print(f"  Run 1: {a}")
        print(f"  Run 2: {b}")
        print(f"  Run 3: {c}")

pct = identical / len(df) * 100
print(f"\nIdentical across all 3 runs: {identical}/{len(df)} ({pct:.1f}%)")
print(f"Target: >= 95%")
