# Running log of failures and oddities

A running log of bugs, unexpected behaviours, and identified limitations,

**[Fixed]** — addressed, with the fix described.
**[Inherent]** — a real limitation that remains, by design or by nature of the model.
**[Finding]** — not a failure, but something the process revealed.

## Day 3 - Pipeline and dashboard

### [Fixed] Theme discovery reflected the sample rather than the dataset

An 8-comment sample containing mostly complaints produced an entirely
negative theme list. The 2 positive comments did not fit any discovered
theme and were classified as "Other." Theme quality therefore depends
on how representative the discovery sample is.

**Fix (Day 4):** Theme discovery now runs on several independent random samples
drawn from the full dataset before merging the resulting theme lists into a
single consensus list. Themes recurring across samples are treated as robust,
while one-off themes are treated as sample noise. Random sampling also replaced
the previous "first N comments" approach, making discovered themes representative
of the dataset rather than its opening rows.

**Cost note:** This increases discovery from one API call to four. Since discovery
runs only once per upload, not once per comment. The additional cost is negligible
compared with per-comment classification. 

### [Fixed] Discovered theme names encoded sentiment

"Shipping was super fast" was classified under **"Delivery issues"** with 
**positive** sentiment, creating a contradiction. Because the discovery sample was
dominated by complaints, the model named themes as problems rather than neutral topics,
conflating **theme** and **sentiment** into a single dimension.

**Fix (Day 4):** The discovery prompt now requires neutral, topic-based theme names
(e.g., **"Delivery speed"** instead of **"Delivery issues"**) and explicit coverage of
positive and non-complaint topics. The in-prompt example was changed too as it previously
demonstrated problem-style names.

**Effect:** **"Delivery speed"** now captures both complaints about slow shipping and praise
for fast delivery, while **"App performance"** emerged as a distinct theme.
The **"Other"** rate on the sample fell to zero. Two cases previously recorded as 
classification errors (*"app crashes"* -> **"Payment issues"** and 
*"Love it"* -> **"Other"**) also disappeared without any changes to the classifier itself,
indicating that they were also caused by incomplete theme coverage rather than
classification errors.

### [Inherent] Theme-list capacity limits coverage

With `n_themes` fixed at 6, datasets containing more than 6 meaningful topics inevitably requires
some topics to be merged or misassigned. For example, *"Payment failed twice and I got charged anyway"* was classified under **"Pricing"** because no dedicated payments or billing theme existed.
This is a capacity limitation rather than a classification error. The appropriate mitigation is to
choose `n_themes` according to the dataset or expose it as a configurable user setting.

### Single-labeled classification oversimplifies multi-theme comments

A comment such as "The item arrived broken and returns were a nightmare"
was assigned only "Customer service issues" rather than "Damaged items."
The comment legitimately belongs to multiple themes, but the prompt enforces
exactly one label. This is a design trade-off rather than a bug, and causes
secondary concerns to be omitted from the theme counts.

### [Inherent] Theme discovery is not fully deterministic

Running theme discovery twice on identical input produced different final themes
despite using temperature 0. Temperature 0 reduces variation but does not
eliminate it.

This limitation cannot be eliminated at the application layer and is therefore
treated as a property of the underlying model rather than a defect. Its practical
impact is limited because discovery runs only once per upload, after which the resulting
theme list is fixed for all subsequent classification. The multi-sample discovery
strategy further reduces instability by favouring themes that recur across independent
samples. Run-to-run consistency is measured and reported explicitly (Day 5) rather
than assumed.

### [Expected -> Fixed] Discovered themes may receive no assignments
In one run, "Poor communication" was discovered as a theme, yet no comments were 
ultimately classified into it. As a result, the theme appeared in the 
discovered theme list but not in the dashboard counts. 

The cause is the single-labeled constraint above rather than an error in theme discovery.
During Pass 1, the model analyses all comments together and recognises that a complaint
such as "The delivery took three weeks and no one updated me" concerns both delivery
delays and poor communication, so it proposes both themes. During Pass 2, however, 
the same comment must be assigned exactly one primary theme. A theme that is never the
dominant concern of any individual comment can therefore be discovered but never assigned.
Zero-count themes are simply the visible consequence of this information loss.

**Fix (Day 4)**: Theme counts are now initialised to zero for every discovered theme,
ensuring that such themes appear as empty bars rather than disappearing entirely.
This accurately communicates that the topic exists in the feedback but is never the primary
concern of any single comment.

## Day 4 - Evaluation set and baselines

### [Finding] Discovered themes organise by issue type, not product category
Running theme discovery on 360 real CFPB complaints produced the themes 
**Credit reporting, Loan servicing, Account access, Fraud disputes, Fees and charges,**
and **Customer support.**

The CFPB's human labels, by contrast, are **product categories: Credit reporting, Debt
collection, Mortgage, Credit card, Checking or savings account,** and **Student loan.**
Only **Credit reporting** appears in both taxonomies.

This observation has two important implications. First, it demonstrates that evaluating
discovered themes directly against CFPB product labels would be conceptually unsound, 
since the two taxonomies are not measuring the same construct. This justifies bypassing theme
discovery and using the fixed CFPB categories for the accuracy evaluation. Second, the discovered
taxonomy is arguably more actionable in practice: **Fees and charges** identifies a specific
class of problems to investigate, whereas **Mortgage** identifies only the product involved.

### [Fixed] CFPB date field is inconsistent

`Date received` column mixes plain dates (e.g., `2023-03-11`) with full ISO timestamps,
as well as timezone-naive and timezone-aware values. 
Parsing required `format="mixed", utc=True`, and the post-2017 filter had to use a
timezone-aware comparison. This reflects the messiness of real-world data rather than
a flaw in the pipeline.

### [Fixed] Complaint narratives are optional

Most CFPB records contain no complaint narrative, leaving the text field empty. These
rows must be filtered out before sampling; otherwise, the evaluation set would contain
blank inputs that cannot be classified.

### [Fixed] `groupby` moved the grouping column into the index

The initial class-balanced sampling implementation failed with `KeyError: ['label'] not in index`
because `groupby("Product")` moved `Product` into the index. Replaced the groupby
with an explicit per-category loop. 

### [Inherent, by design] The keyword baseline is intentionally simplistic

When no keyword matches, the baseline defaults to predicting "Credit reporting", the
largest class. This biases recall toward that category and prevents the model from abstaining on 
uncertain cases. As a result, it serves only as a deliberately weak lower bound,
motivating the inclusion of TF-IDF + Logistic Regression as a stronger and more 
credible baseline.

## Day 5 - Evaluation and interpretation

### [Finding] Metric disagreement between macro-F1 and κ, caused by abstention

TF-IDF led macro-F1 (0.779 vs 0.736) and Tally led Cohen's κ (0.827 vs 0.737).
The gap traces to abstention: Tally assigned "Other" to 3/360 complaints, and
since no true label is ever "Other," these count against macro-F1. Inspection of
the three showed genuine edge cases (a non-complaint, an e-commerce issue labeled
"Credit card", and a cross-category scam). In at least two, "Other" arguably fits
the text better than the assigned CFPB label. The small macro-F1 gap therefore
reflects a decision to abstain on hard cases, not weaker classification. 

### [Finding] Run-to-run instability tracks genuine ambiguity

Consistency measured ~97-98% (58-59 / 60 across two measurements; the figure
varies slightly between measurements, as expected for a stochastic system).
Disagreements are not random: they fall on complaints that legitimately belong to
two adjacent categories (e.g. a collections letter that also appears on a credit
report), where the model alternates between two defensible labels. Instability is
concentrated where the ground truth is itself ambiguous, not spread across
clear-cut cases.

### [Note] Macro-F1 has no absolute interpretation

Unlike κ (interpreted on the Landis & Koch scale), macro-F1 has no standard
"good/bad" thresholds. It is therefore reported only relative to baselines
(keyword, TF-IDF) and to chance (~0.17 on six balanced classes), never as an
absolute score.

## Day 8 - Robustness and scale

### [Fixed] Silent data loss on messy CSVs

Unquoted commas in comment fields made pandas miscount columns and drop rows. 
A 5-row file silently became 3 rows, flipping the dashboard to a false "100% negative". 

Root cause: comment text with commas read as extra columns. 

Fix: layered file reader (standard -> auto-delimiter -> Excel -> line-by-line), 
which keeps every comment, plus a UI warning when the line-by-line fallback fires.

### [Fixed] Parallelism cuts latency

Processing of 100 rows sequentially took ~3 min. By running classification 
through a 10-thread pool, processing time dropped to ~37 seconds for 200 rows. 
This optimisation uses parallelism rather than batching—each comment. 
So, API cost is unchanged, only wall-clock time is reduced. 

### [Finding] Adaptive theme count required a minimum threshold

Setting n_themes = len // 3 produced only 3 themes for a 10-row dataset, 
causing comments such as "support was fantastic" to be grouped into Other 
because no support theme was generated. The issue did not produce errors 
but instead forced valid comments into inappropriate themes. 
A minimum theme count was introduced and validated on larger, real-sized datasets.

## Day 8 - Multi-label and honesty in counts
### [Finding] Muli-label feedback breaks single-count summaries

Comments often span multiple themes (e.g. "broken AND returns were a nightmare"). 
Counting only the primary theme keeps totals equal to N, while counting every mentioned 
theme results in totals exceeding N. Rather than forcing a single interpretation, 
both views were retained and exposed through a Primary/Mentions toggle, making the counting method explicit.

### [Observed] Theme capacity and single sentiment struggle with mixed feedback

Comments such as "Too expensive and the quality feels cheap for the price" naturally 
span both pricing and quality. Increasing the number of themes improves coverage but 
cannot eliminate inherently cross-cutting feedback. Likewise, assigning a single 
sentiment label oversimplifies mixed opinions. Multi-label themes mitigate the issue, 
but the remaining ambiguity is inherent to the data rather than a system bug.

## Day 8 - Statistics
### [Finding] Z-score anomaly detection requires baseline variation

A theme that is perfectly stable then spikes (sd ~ 0) yields an undefined z-score, so the
z-test anomaly detector cannot flag the single most alarming case. Guard (sd < 0.5 skip)
prevents false alarms on flat baselines but also blocks this true positive. Note: the
significance test in the same view (two-proportion z-test, which does not divide by variance)
DID flag this case independently - so a user sees the finding there. The two detectors are not
coordinated in code; they are separate views that happen to have complementary blind spots.
Coordinating them (fall back to the proportion test when variance is zero) is a next step.

### [Finding] Blanket sample-size guard hid genuine significance

A rule marking any period with fewer than 30 comments as "too few" suppressed legitimate findings, 
including an App performance increase of +60 percentage points (p = 0.006). The dataset-level 
threshold proved overly conservative. A per-theme minimum count check (c1 + c2 < 5) is 
the more appropriate safeguard for a two-proportion test.

### [Verified] Hand-written statistical methods match SciPy

Implemented the error function (erf), two-proportion z-test, and chi-square test without relying 
on SciPy. Verified against SciPy's reference implementations: erf accurate to approximately 1×10⁻⁷, 
z-test identical to 4 decimal places, and chi-square (Wilson–Hilferty approximation) within 0.0002. 
Statistical conclusions were identical across all verification cases. See STATS_VERIFICATION.md for details.

## Day 12 - Improved Missing Data Handling
### [Fixed] NaN in metadata crashed JSON serialisation

Empty cells in segment columns became NaN, wich is not JSON-compliant. Fixed by filling missing metadata 
with "(missing)" before serialisation. Added a recursive check to replace any remaining NaN values in 
the response. This issue only surfaced when testing with a deliberately messy dataset, as clean datasets 
contained no missing values.