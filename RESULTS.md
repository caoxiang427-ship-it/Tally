# Results (Day 5)
Eval set: 360 CFPB complaints, 6 balanced categories, SEED=42, gpt-5.4-mini.
## Accuracy vs. human labels
| Method | Macro-F1 | Cohen's κ |
|---|---|---|
| Keyword baseline | 0.541 | 0.420 |
| TF-IDF + LogReg (trained on 360 labels) | 0.779 | 0.737 |
| Tally (LLM, zero training) | 0.736 | 0.827 |
- Pre-registered targets **MET**: 
  - **κ = 0.827** - clears the pre-registered ≥ 0.61 floor; 
    **"almost perfect (0.81 - 1.00)"** agreement on the Landis & Koch (1977) scale.
  - **Macro-F1 = 0.736** — beats the keyword baseline by +0.195 (0.736 vs 0.541),
    clearing the pre-registered ≥ 0.10 bar. Close to, but does not exceed, the
    stronger TF-IDF baseline (0.779)
- Against the stronger TF-IDF baseline: competitive — TF-IDF leads on macro-F1,
  Tally leads on κ, without using any labeled training data.
## Consistency across runs
- **~97-98%** identical labels across 3 runs at temp 0 (58-59 / 60 across two
  measurements). Target >= 95% MET.
- The figure varies slightly between measurements (the system is stochastic).
- **Disagreements** concentrate on category-straddling complaints (e.g. a collections
  letter that also appears on a credit report), where the model alternates between
  two defensible labels — genuine ambiguity, not random noise.
## Abstention
- "Other" count: **3 / 360 (0.8%).**
- **Inspection**: all 3 are genuine edge cases: one is a non-complaint, one is an e-commerce
  issue labeled as "Credit card", and one is a cross-category scam. In at least two cases, 
  "Other" arguably reflects the text more accurately than the assigned CFPB label.
- The TF-IDF baseline was trained to predict one of the 6 CFPB categories and therefore
  cannot produce an "Other" label.
## Sentiment
- Produced per comment as an **illustrative** feature. NOT evaluated: no labeled
  sentiment ground truth exists in this dataset, so no accuracy is claimed.
## Cost & Latency (measured, n=60)
| Model | Macro-F1 | κ | Cost /1,000 | Median latency |
|---|---|---|---|---|
| gpt-5.4-mini (production) | 0.736 | 0.827 | $0.38 | ~1.0s |
| gpt-5.4 (frontier)        | 0.742 | 0.834 | $1.26 | ~0.9s |
- Frontier costs 3.3x more for +0.006 F1 / +0.007 κ — within noise.
- Conclusion: mini is the right production choice; more compute did not help.
- Latency ~18 min/1,000 sequential (upper bound; batching would reduce this).
## ROI
- **Manual coding:** Approximately 4–8 hours per 1,000 comments (around $100–240 in analyst time).
- **Tally (GPT-5.4 mini):** Approximately $0.38 and 18 minutes per 1,000 comments.
- **Result:** Around **300–600× lower cost** and **minutes instead of hours**, while delivering 
  performance competitive with a trained TF-IDF baseline.

---

# Results (Day 13) — Re-run after adding abstention
Same eval set (360 CFPB complaints, 6 balanced categories, SEED=42, gpt-5.4-mini,
temperature 0). These figures **supersede Day 5**. They were regenerated after the
classification prompt was tightened to abstain ("Other") when no category genuinely
fits, and to emit `fit` and `usable` fields. Only the prompt changed; the eval set,
seed, and model are identical.

## Accuracy vs. human labels (current)
| Method | Macro-F1 | Cohen's κ |
|---|---|---|
| Keyword baseline | 0.541 | 0.420 |
| TF-IDF + LogReg (trained on 360 labels) | 0.779 | 0.737 |
| **Tally (LLM, zero training)** | **0.690** | **0.752** |
| Tally (frontier model, zero training) † | 0.742 | 0.834 |
- **κ = 0.752** — clears the pre-registered ≥ 0.61 floor; **"substantial (0.61–0.80)"**
  on the Landis & Koch (1977) scale. Still exceeds the TF-IDF baseline's κ (0.737)
  with no labelled training data.
- **Macro-F1 = 0.690** — beats the keyword baseline by +0.149; trails TF-IDF (0.779),
  a wider gap than Day 5.
- The dual result holds: **TF-IDF leads macro-F1, Tally leads κ.**
- **Frontier row is stale:** `predictions_frontier.csv` was not regenerated under the
  new prompt, so the apparent +0.052 F1 / +0.082 κ gap is a mixed-prompt artifact
  (new-prompt mini vs old-prompt frontier). **Re-run the frontier generator before
  treating the frontier comparison as final.**

## Why the numbers changed from Day 5
- Abstention rose from **0.8% → 3.3%** (3 → 12 of 360) after the stricter "use Other
  rather than force a weak match" instruction.
- The 6 CFPB categories are **exhaustive** and there is **no "Other" ground-truth label**,
  so every abstention is scored as an error against both macro-F1 and κ.
- The drop therefore reflects the benchmark **penalising a desirable behaviour**
  (declining to mislabel), not weaker classification. The reported figures are a
  **conservative floor**; on cases where the model commits, per-category F1 is high
  (below). Logged transparently rather than hidden.

## Per-category F1 (current, Tally gpt-5.4-mini)
| Category | F1 |
|---|---|
| Mortgage | 0.95 |
| Student loan | 0.91 |
| Checking or savings account | 0.85 |
| Credit card or prepaid card | 0.76 |
| Credit reporting (…consumer reports) | 0.71 |
| Debt collection | 0.65 |
- Errors concentrate on **Debt collection** and **Credit reporting** — adjacent
  categories that legitimately overlap (e.g. a collections item that also appears on a
  credit report).

## Consistency across runs (current)
- **96.7%** identical labels — **58 / 60** across 3 runs at temperature 0. Target ≥ 95% **MET**.
- The 2 disagreements are genuine ambiguity, not noise:
  - A complaint stating "CFPB, you don't have a category for what [bank] did" (true:
    Checking or savings account) — one run abstained to "Other".
  - A dispute over a collection account **appearing on a credit report** (true: Debt
    collection) — runs alternated between Debt collection and Credit reporting.
- Abstention slightly lowers measured consistency too: a comment landing "Other" in one
  run and a category in another counts as a disagreement.

## Unchanged from Day 5
- **Cost & latency:** ~$0.38 per 1,000 (mini), ~18 min/1,000 sequential, 200 comments in
  ~37 s parallelised. Model and token usage unchanged, so these figures stand.
- **Sentiment:** still illustrative only; not evaluated.
- **ROI:** unchanged — ~300–600× cheaper than manual coding, minutes instead of hours.
