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
- ~97-98% identical labels across 3 runs at temp 0 (58-59 / 60 across two
  measurements). Target >= 95% MET.
- The figure varies slightly between measurements (the system is stochastic).
- Disagreements concentrate on category-straddling complaints (e.g. a collections
  letter that also appears on a credit report), where the model alternates between
  two defensible labels — genuine ambiguity, not random noise.

## Abstention
- "Other" count: 3 / 360 (0.8%).
- Inspection: all 3 are genuine edge cases: one is a non-complaint, one is an e-commerce
  issue labeled as "Credit card", and one is a cross-category scam. In at least two cases, 
  "Other" arguably reflects the text more accurately than the assigned CFPB label.
- The TF-IDF baseline was trained to predict one of the 6 CFPB categories and therefore
  cannot produce an "Other" label.

## Cost / Latency
- [Day 6]
