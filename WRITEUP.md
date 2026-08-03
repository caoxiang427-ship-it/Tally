# Tally

**Cao Xiang · The LaunchPad Challenge**

Tally turns large volumes of unlabelled open-ended feedback into structured, countable, per-comment analysis with statistical validation.

---

## Problem

Organisations collect large volumes of open-ended feedback, making manual review increasingly impractical. Traditional text classifiers can be accurate but require labelled training data for predefined categories, whereas real-world feedback is typically unlabelled, organisation-specific, and constantly evolving. General-purpose chatbots can summarise a small set of comments, but on hundreds or thousands they tend to produce high-level summaries rather than consistent per-comment classifications, with outputs that can vary between runs.

Tally addresses this gap: unlabelled feedback where categories are not known in advance, at a scale where manual review and conversational AI become unreliable, yet results must be structured, countable, and reproducible enough for reporting. Two decisions shaped the design from the outset. Success criteria were pre-registered before any evaluation. And, because open-ended feedback tends to organise by issue rather than by predefined product category, Tally discovers themes from the data rather than assuming a taxonomy, an observation that shaped the evaluation itself.

## Approach

Tally uses a multi-pass pipeline. The first pass discovers recurring themes directly from the data by running theme discovery on several independent samples and merging the results, retaining only themes that appear consistently across samples. Classical unsupervised alternatives (embedding-based clustering) were rejected because they return word clusters that still need manual labelling to become reportable themes, whereas the LLM returns named, human-readable themes directly. An optional domain context ("a restaurant") can focus discovery toward relevant themes. A classification pass then labels each comment with a primary theme, optional secondary themes, sentiment, and two scores: confidence (certainty among the offered themes) and fit (how well the comment matches that theme). Comments that fit no theme are re-clustered by a second discovery pass into broader themes; opinions with no topic ("love it") fall to a fixed "General sentiment" theme, and genuinely contentless comments are flagged for exclusion. All model calls run at temperature 0 to maximise reproducibility.

Traditional supervised classifiers, such as TF-IDF-based models, require labelled in-domain training data before they can be used; Tally instead generates a usable theme set directly from raw, unlabelled text. To evaluate classification independently of discovery, a bypass mode accepts a fixed set of reference categories in place of the discovered themes. These per-comment classifications also power higher-level analyses: multi-label counts, comparisons across time periods, segment analysis, and significance testing.

## Evidence

Success criteria were pre-registered and committed to version control before any evaluation was performed, so targets could not be adjusted after results were known. Evaluation used the public CFPB Consumer Complaint Database, comprising 360 complaints evenly distributed across 6 categories, with a fixed random seed.

Compared with the supervised TF-IDF baseline, Tally is competitive rather than superior. TF-IDF achieves a higher Macro-F1 score, while Tally achieves a higher Cohen's κ despite requiring no labelled training data. Its κ of 0.752 falls within the "substantial" agreement range on the Landis–Koch scale and exceeds the pre-registered threshold (κ ≥ 0.61). Across three runs at temperature 0, classifications were 96.7% identical (58 of 60), with disagreements concentrated on genuinely category-spanning complaints rather than random variation. Tally abstains, assigning "Other", on 3.3% of cases rather than forcing a weak match; because the six CFPB categories are exhaustive and include no "Other" label, every abstention is scored as an error, so the reported figures are a conservative floor that penalises the deliberate abstention which avoids false labels on open-ended feedback.

This issue-versus-product mismatch is why a fair comparison required the fixed-category bypass, isolating classification accuracy from discovery quality. The statistical analyses introduced later (the two-proportion z-test, chi-square test, and standardised residuals) were implemented without SciPy and verified against its reference implementations, matching within 0.0002. Sentiment labels are generated for every comment but presented for illustrative purposes only, as no labelled sentiment ground truth is available and no claim of sentiment accuracy is made.

## Constraints

At the measured token usage, classification costs approximately $0.38 per 1,000 comments using the production model. A frontier model was evaluated as a costlier alternative at 3.3× the cost. Because the production model already clears the pre-registered threshold, the cost and latency gap makes it the appropriate production choice: additional compute is not required to meet the target.

Sequential processing requires approximately 18 minutes per 1,000 comments, an upper-bound latency. Thread-based parallelism cut processing time for 200 comments from around 3 minutes to 37 seconds. Compared with manual coding, which typically requires 4 to 8 hours and costs approximately $100–240 per 1,000 comments, Tally is 2 to 3 orders of magnitude cheaper and finishes in minutes, without sacrificing the accuracy shown above.

The evaluation was intentionally scoped to 6 of the approximately 20 CFPB categories. Performance would likely decline when extended to the full taxonomy; this is future work, not a current capability.

## Honesty and Trajectory

Classification is evaluated against human-labelled ground truth; sentiment and multi-label outputs are included but not formally evaluated. Confidence reflects the best available theme rather than correctness, so the fit score and review queue exist to surface confident-but-wrong labels that confidence alone would hide.

Theme discovery is not fully deterministic even at temperature 0, so runs can surface a slightly different theme set. Because the segment breakdown counts each comment under its primary theme, a changed theme set shifts those counts, most visibly in small segments where one comment can flip the top theme; segments under twenty responses are therefore greyed as untrustworthy. Against a fixed theme list, classification itself is ~97% consistent. The statistical methods are verified for implementation correctness, not empirical truth; their value is in careful application, including flagging small samples and disclosing the false-positive risk of testing many themes at once.

Remaining limits are explicit: Tally analyses one text column and one segmentation dimension at a time, and user corrections are session-only. Future work: evaluating the fit and exclusion signals, extending to the full CFPB taxonomy, testing a second non-financial domain, and improving run-to-run consistency.

---

## Appendix

### Repository guide
- `backend/pipeline.py` — the multi-pass theme-discovery and classification pipeline (the core method).
- `backend/api.py` — FastAPI endpoints, robust CSV parsing, parallel classification, and the statistical tests (chi-square, two-proportion z-test, standardised residuals, anomaly z-scores).
- `backend/run_llm.py`, `backend/evaluate.py`, `backend/consistency.py` — generate predictions, score accuracy, and measure run-to-run consistency.
- `backend/SUCCESS_CRITERIA.md` — success criteria, pre-registered before evaluation.
- `backend/RESULTS.md` — evaluation methodology and the measured results behind the accuracy claims.
- `backend/STATS_VERIFICATION.md` — hand-implemented statistics verified against scipy.
- `src/App.jsx` — dashboard, review queue, segment analysis, and trend analysis.
- `LIMITATIONS.md`, `failures.md` — known limitations and a running log of issues and fixes.
- `WRITEUP.md` — the five-pillar write-up.

### Table 1: Accuracy vs. human labels

| Method | Macro-F1 | Cohen's κ |
|---|---|---|
| Keyword baseline | 0.541 | 0.420 |
| TF-IDF + LogReg (trained on 360 labels) | 0.779 | 0.737 |
| **Tally (LLM, zero training)** | **0.690** | **0.752** |
| Tally — frontier model (zero training)† | 0.742 | 0.834 |

*Evaluated on 360 CFPB complaints, 6 balanced categories, `SEED=42`, temperature 0, gpt-5.4-mini. Tally leads on κ despite using no labelled training data; it trails on Macro-F1, partly because it abstains ("Other") on 3.3% of cases and every abstention is scored as an error against these exhaustive labels.*
*† Frontier row pending re-evaluation under the current classification prompt; the figures shown are from the prior prompt version.*

### Table 2: Abstention and per-category performance (Tally, gpt-5.4-mini)

| Category | F1 |
|---|---|
| Mortgage | 0.95 |
| Student loan | 0.91 |
| Checking or savings account | 0.85 |
| Credit card or prepaid card | 0.76 |
| Credit reporting (…consumer reports) | 0.71 |
| Debt collection | 0.65 |

*"Other" (abstention): 12 / 360 = 3.3%. Errors concentrate on Debt collection and Credit reporting, adjacent categories that legitimately overlap (e.g. a collections item that also appears on a credit report), which is also where run-to-run disagreements fall.*

### Table 3: Cost & latency (per 1,000 comments)

| | Production model | Manual coding |
|---|---|---|
| Cost | ~$0.38 | ~$100–240 |
| Latency (sequential) | ~18 min | 4–8 hours |
| Latency (parallelised) | 200 comments in 37 s (from ~3 min) | n/a |

*Parallelism via a thread pool (up to 10 concurrent classifications). The frontier model costs ~$1.26 per 1,000 (3.3×).*

### Table 4: Statistical method verification

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
- **Model:** gpt-5.4-mini (evaluation and production)
- **Repository:** https://github.com/caoxiang427-ship-it/Tally
