# Statistics Verification

Custom implementations (no scipy in production) verified against scipy reference. Run: `python verify_stats.py`

### erf (JS approximation) vs scipy.special.erf

| x | hand-rolled | scipy | abs diff |
|---|---|---|---|
| -2.0 | -0.995322 | -0.995322 | 1.25e-07 |
| -0.5 | -0.520500 | -0.520500 | 1.38e-07 |
| 0.0 | 0.000000 | 0.000000 | 1.00e-09 |
| 0.5 | 0.520500 | 0.520500 | 1.38e-07 |
| 1.0 | 0.842701 | 0.842701 | 1.03e-07 |
| 1.96 | 0.994426 | 0.994426 | 1.16e-07 |
| 3.0 | 0.999978 | 0.999978 | 1.47e-08 |

### Two-proportion z-test vs scipy (via proportions_ztest equivalent)

| case (c1/n1 vs c2/n2) | hand-rolled p | scipy p | abs diff |
|---|---|---|---|
| 60/150 vs 30/150 | 0.0002 | 0.0002 | 0.0000 |
| 40/100 vs 38/100 | 0.7719 | 0.7719 | 0.0000 |
| 10/50 vs 20/50 | 0.0291 | 0.0291 | 0.0000 |
| 5/20 vs 15/20 | 0.0016 | 0.0016 | 0.0000 |

### Chi-square (Wilson-Hilferty approx) vs scipy.stats.chi2_contingency

| case | hand-rolled p | scipy p | abs diff |
|---|---|---|---|
| strong association | 0.0 | 0.0 | 0.0000 |
| no association | 1.0 | 1.0 | 0.0000 |
| rating x theme (small) | 0.0016 | 0.0015 | 0.0001 |
| moderate | 0.0096 | 0.0098 | 0.0002 |

**Interpretation:** erf and z-test match scipy to ~4 decimal places. Chi-square uses the Wilson-Hilferty normal approximation, so p-values match scipy closely in the decision-relevant range (near 0.05) but may differ more in the extreme tails, where the exact value doesn't affect the significant/not-significant verdict.
