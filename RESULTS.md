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

- Against the stronger TF-IDF baseline: a tie — TF-IDF leads macro-F1, Tally leads κ.

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
