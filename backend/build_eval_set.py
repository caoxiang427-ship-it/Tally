import pandas as pd

RAW = "data/complaints.csv"
OUT = "data/eval_set.csv"
PER_CLASS = 60      # 60 * 6 categories = 360 complaints
SEED = 42           # fixed seed -> reproducible

CATEGORIES = [
    "Credit reporting, credit repair services, or other personal consumer reports",
    "Debt collection",
    "Mortgage",
    "Credit card or prepaid card",
    "Checking or savings account",
    "Student loan",
]

cols = ["Date received", "Product", "Consumer complaint narrative"]
df = pd.read_csv(RAW, usecols = cols, low_memory=False)

df = df.dropna(subset=["Consumer complaint narrative"])

df["Date received"] = pd.to_datetime(df["Date received"], format="mixed", utc=True)

df = df[df["Date received"] >= pd.Timestamp("2017-05-01", tz="UTC")]

df = df[df["Product"].isin(CATEGORIES)]

# Class-balanced sample
parts = []
for cat in CATEGORIES:
    g = df[df["Product"] == cat]
    parts.append(g.sample(n=min(PER_CLASS, len(g)), random_state=SEED))
sample = pd.concat(parts)

out = sample.rename(columns={
    "Consumer complaint narrative": "text",
    "Product": "label",
})[["text", "label"]]
out.to_csv(OUT, index=False)

print(f"Saved {len(out)} rows to {OUT}")
print(out["label"].value_counts())
# print(df["Product"].unique())
