# Tally

**Cao Xiang · The LaunchPad Challenge**

Tally turns large volumes of unlabelled open-ended feedback into structured, countable, per-comment analysis with statistical validation.

---

## Problem

Organisations collect large volumes of open-ended feedback, making manual review increasingly impractical. Traditional text classifiers can be accurate but require labelled training data for predefined categories, whereas real-world feedback is typically unlabelled, organisation-specific, and constantly evolving. General-purpose chatbots can summarise a small set of comments, but on hundreds or thousands they tend to produce high-level summaries rather than consistent per-comment classifications, with outputs that can vary between runs.

Tally addresses this gap: unlabelled feedback where categories are not known in advance, at a scale where manual review and conversational AI become unreliable, yet results must be structured, countable, and reproducible enough for reporting. Two decisions shaped the design from the outset. Success criteria were pre-registered before any evaluation. And, because open-ended feedback tends to organise by issue rather than by predefined product category, Tally discovers themes from the data rather than assuming a taxonomy, an observation that shaped the evaluation itself.

## Approach

Tally uses a multi-pass pipeline. The first pass discovers recurring themes directly from the data by running theme discovery on several independent samples and merging the results, retaining only themes that appear consistently across samples. Classical unsupervised alternatives (embedding-based clustering, or topic models such as LDA) were rejected because they return word clusters that still need manual labelling to become reportable themes, whereas the LLM returns named, human-readable themes directly. An optional domain context (e.g. "a restaurant") can focus discovery toward relevant themes. A classification pass then labels each comment with a primary theme, optional secondary themes, sentiment, and two scores: confidence (certainty among the offered themes) and fit (how well the comment matches that theme). Comments that fit no theme are re-clustered by a second discovery pass into broader themes rather than labelled individually; genuinely contentless comments are flagged for exclusion instead of forced into a label. All model calls run at temperature 0 to maximise reproducibility.

Traditional supervised classifiers, such as TF-IDF-based models, require labelled in-domain training data before they can be used; Tally instead generates a usable theme set directly from raw, unlabelled text. To evaluate classification independently of discovery, a bypass mode accepts a fixed set of reference categories in place of the discovered themes. These per-comment classifications also power higher-level analyses: multi-label counts, comparisons across time periods, segment analysis, and significance testing.

## Evidence

Success criteria were pre-registered and committed to version control before any evaluation was performed, so targets could not be adjusted after results were known. Evaluation used the public CFPB Consumer Complaint Database, comprising 360 complaints evenly distributed across 6 categories, with a fixed random seed.

Compared with the supervised TF-IDF baseline, Tally is competitive rather than superior. TF-IDF achieves a higher Macro-F1 score, while Tally achieves a higher Cohen's κ despite requiring no labelled training data. Its κ of 0.827 falls within the "almost perfect" agreement range on the Landis–Koch scale and exceeds the pre-registered threshold (κ ≥ 0.61). Across three runs at temperature 0, classifications were approximately 97–98% identical, with disagreements concentrated on genuinely category-spanning complaints rather than random variation. Tally assigned "Other" to only 0.8% of cases, all of which manual inspection confirmed as genuine edge cases outside the fixed taxonomy, representing deliberate abstention rather than misclassification.

This issue-versus-product mismatch is why a fair comparison required the fixed-category bypass, isolating classification accuracy from discovery quality. The statistical analyses introduced later (the two-proportion z-test, chi-square test, and standardised residuals) were implemented without SciPy and verified against its reference implementations, matching within 0.0002. Sentiment labels are generated for every comment but presented for illustrative purposes only, as no labelled sentiment ground truth is available and no claim of sentiment accuracy is made.

## Constraints

At the measured token usage, classification costs approximately $0.38 per 1,000 comments using the production model. A frontier model was evaluated as a costlier alternative. Despite costing 3.3× more, it improved Macro-F1 by only 0.006 and Cohen's κ by 0.007, well within measurement noise. The lower-cost model is therefore the production choice; the comparison is itself useful: additional compute did not meaningfully improve accuracy.

Sequential processing requires approximately 18 minutes per 1,000 comments, an upper-bound latency. Thread-based parallelism cut processing time for 200 comments from around 3 minutes to 37 seconds. Compared with manual coding, which typically requires 4 to 8 hours and costs approximately $100–240 per 1,000 comments, Tally is 2 to 3 orders of magnitude cheaper and finishes in minutes, without sacrificing the accuracy shown above.

The evaluation was intentionally scoped to 6 of the approximately 20 CFPB categories. Performance would likely decline when extended to the full taxonomy; this is future work, not a current capability.

## Honesty and Trajectory

Classification performance is evaluated against human-labelled ground truth. Sentiment and multi-label outputs are included but not formally evaluated. Confidence reflects the best available theme rather than correctness, so the fit score and review queue exist to surface confident-but-wrong labels that confidence alone would hide. Domain context steers discovery, but its accuracy impact is likewise unmeasured, since testing it would require re-running the evaluation with and without context. The statistical methods are verified for implementation correctness rather than empirical ground truth; their contribution lies in careful application: flagging small samples, greying out segments with fewer than twenty responses, disclosing the risk of false positives when testing multiple themes, and declining to compute period anomalies with fewer than four periods.

The system's limitations are explicit. Tally analyses one text column and one segmentation dimension at a time. User corrections update the dashboard and exports but are session-only. Trend analysis compares uploaded datasets rather than continuously monitoring incoming data. Z-score anomaly detection cannot identify a perfectly stable theme that suddenly spikes, because a near-zero baseline variance makes the statistic undefined; the complementary two-proportion significance test detects these cases.

Future work would be: formally evaluating the multi-label, fit, and exclusion predictions; extending the evaluation to the full CFPB taxonomy; re-running it on a second, non-financial domain; persisting user corrections; applying multiple-comparison corrections; and improving run-to-run consistency.

---

## Appendix

### Repository guide
- `backend/pipeline.py` — the multi-pass theme-discovery and classification pipeline (the core method).
- `backend/api.py` — FastAPI endpoints, robust CSV parsing, parallel classification, and the statistical tests (chi-square, two-proportion z-test, standardised residuals, anomaly z-scores).
- `backend/SUCCESS_CRITERIA.md` — success criteria, pre-registered before evaluation.
- `backend/RESULTS.md` — evaluation methodology and the measured results behind the accuracy claims.
- `backend/STATS_VERIFICATION.md` — hand-implemented statistics verified against scipy.
- `src/App.jsx` — dashboard, review queue, segment analysis, and trend analysis.
- `LIMITATIONS.md` — known limitations and next steps.
- `failures.md` — running log of issues found and how they were handled.
- `WRITEUP.md` — the five-pillar write-up.

### Table 1: Accuracy vs. human labels

| Method | Macro-F1 | Cohen's κ |
|---|---|---|
| Keyword baseline | 0.541 | 0.420 |
| TF-IDF + LogReg (trained on 360 labels) | 0.779 | 0.737 |
| **Tally (LLM, zero training)** | **0.736** | **0.827** |
| Tally (frontier model, zero training) | 0.742 | 0.834 |

*Evaluated on 360 CFPB complaints, 6 balanced categories, fixed seed, temperature 0. The frontier model improves Macro-F1 by 0.006 and κ by 0.007 for 3.3× the cost (a negligible gain), so the smaller model is the production choice.*

### Table 2: Cost & latency (per 1,000 comments)

| | Production model | Frontier model | Manual coding |
|---|---|---|---|
| Cost | ~$0.38 | ~$1.26 (3.3×) | ~$100–240 |
| Latency (sequential) | ~18 min | n/a | 4–8 hours |
| Latency (parallelised) | 200 comments in 37 s (from ~3 min) | n/a | n/a |

*Parallelism via a thread pool (up to 10 concurrent classifications).*

### Table 3: Statistical method verification

| Method | Verified against | Max absolute difference |
|---|---|---|
| erf (normal CDF) | SciPy `scipy.special.erf` | ~1e-7 |
| Two-proportion z-test | SciPy reference | exact to 4 dp (0.0000) |
| Chi-square test of independence | SciPy `chi2_contingency` | < 0.0002 |

*Implemented from scratch (no SciPy dependency) and cross-checked against SciPy on constructed test cases.*

### Reproducibility

- **Dataset:** CFPB Consumer Complaint Database (public)
- **Sample:** 360 complaints, 6 balanced categories
- **Seed:** fixed (`SEED=42`)
- **Temperature:** 0 (both passes)
- **Model:** gpt-5.4-mini
- **Repository:** https://github.com/caoxiang427-ship-it/Tally
