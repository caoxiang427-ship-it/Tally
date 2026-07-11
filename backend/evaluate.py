import pandas as pd
from sklearn.metrics import f1_score, cohen_kappa_score, classification_report

base = pd.read_csv("data/predictions_baselines.csv") # pred_keyword, pred_tfidf
llm = pd.read_csv("data/predictions_llm.csv") # pred_llm
base["pred_llm"] = llm["pred_llm"]

y_true = base["label"]

def score(name, y_pred):
    f1 = f1_score(y_true, y_pred, average="macro")
    kappa = cohen_kappa_score(y_true, y_pred)
    print(f"\n{name}")
    print(f"  Macro-F1:  {f1:.3f}")
    print(f"  Cohen's κ: {kappa:.3f}")
    return f1, kappa

print("=" * 40)
print(f"Eval set: {len(base)} complaints, {y_true.nunique()} categories")
print("=" * 40)

score("Baseline 1 — Keyword matching", base["pred_keyword"])
score("Baseline 2 — TF-IDF + LogReg",  base["pred_tfidf"])
score("Tally — LLM (gpt-5.4-mini)",    base["pred_llm"])

# Per-class detail for the LLM (shows where it wins/loses)
print("\n" + "=" * 40)
print("LLM per-category breakdown:")
print(classification_report(y_true, base["pred_llm"]))
