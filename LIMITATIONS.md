# Known Limitations and Failure Modes

Grouped by category. Each is something observed during development, with its
current status: mitigated, inherent (a design trade-off), or scoped out.

## 1. Task design limitations

**Single-label classification.** Each comment gets one theme, but comments often
span several ("item arrived broken and returns were a nightmare" = product + service).
Secondary concerns are lost from the counts. 

*Status: inherent trade-off* 
  — single labels keep counts unambiguous; a multi-label version exists 
    but can't be evaluated against CFPB's single-label ground truth.

**Fixed theme count.** With n_themes = 6, a dataset with more than six real topics
forces merging or mis-assignment. 

*Status: tunable* — should scale with the data or be user-set.

## 2. Model behaviour limitations

**Non-determinism.** Identical inputs at temperature 0 occasionally produce different
labels (~97-98% consistent). Disagreements concentrate on genuinely ambiguous,
category-straddling comments. 

*Status: measured, not eliminable at the app layer.*

**Discovery instability.** Theme discovery varies more across runs than classification
does. 

*Status: mitigated* via multi-sample discovery + merge (robust themes survive across samples).

**Abstention trade-off.** The model outputs "Other" on hard cases (0.8%), which
slightly lowers macro-F1 since no true label is "Other." 

*Status: intended* — abstaining on genuine edge cases is more honest than forcing a guess.

## 3. Evaluation limitations

**Scoped to 6 of ~20 CFPB categories.** Keeps the task well-defined and balanced, but
accuracy would likely drop on the full taxonomy (more classes, finer distinctions).

*Status: scoped, extension is future work.*

**Sentiment not evaluated.** No labeled sentiment ground truth exists, so sentiment is
illustrative only, not a validated output. 

*Status: scoped out.*

**Discovered themes ≠ CFPB categories.** Discovery organizes by issue type; CFPB labels
organize by product. This is why accuracy uses the fixed-category bypass. 

*Status: a finding that shaped the evaluation design.*

## 4. Data limitations

**Opt-in narratives / redaction.** Only complaints where the consumer opted to share
text are usable, and narratives are redacted (XXXX). Possible selection bias in the
evaluation set. 

*Status: acknowledged.*

## 5. Feature limitation 

### Single text column only. 
Analyses one open-ended column; surveys with several free-text questions
("what went well" vs "what to improve") are only partially covered. Now, 
users can select which column to analyze. 

*Status: next step - user-selectable / multiple text columns.*

### Single segment dimension. 
Breakdowns are one categorical column at a time; no cross-segmentation
(e.g. region x plan together).

*Status: next step - cross-segmentation.*

### Continuous numerics not segmentable. 
Columns like price or age have too many distinct values to group
directly and are flagged "numeric" rather than offered as segments.

*Status: next step - bucketing.*

### Session-only corrections and exclusions. 
Human review edits update the live dashboard and export but
are not persisted; a refresh loses them.

*Status: inherent without storage; persistence is a next step.*

### Trend is comparison, not monitoring. 
Files are re-analysed each session against one shared theme list;
there is no stored history, and new data is analysed only when files
are uploaded.

*Status: scoped - "comparison over time", not continuous monitoring.*

## 6. Statistical limitations

### Anomaly detection needs baseline variance. 
Z-scores cannot flag a perfectly stable theme that suddenly spikes (sd ~ 0 -> undefined). 
The significance test catches these cases instead.

*Status: inherent to z-scoring; mitigated by pairing with the proportion test.*

### Period anomaly needs >= 4 periods. 
Below that the tool declines to compute rather than report an unreliable baseline.

*Status: intended guard.*

### Tests are verified, not baseline-validated. 
Chi-square, two-proportion z-test, and standardised residuals are standard tests, hand-implemented 
without scipy and verified against scipy for correctness (STATS_VERIFICATION.md). They are mathematical, 
not empirical, so there is no ground truth to validate against - only correct implementation and honest 
application (small-sample flags, multiple-comparisons disclosure).

*Status: verified; application guarded.*

### Multiple comparisons. 
Trend significance tests every theme, so ~1 in 20 may appear significant by chance.
Disclosed in-app; no formal correction applied.
Status: disclosed, not corrected - correction is a next step.

## Next steps

### Built since (move out of "next steps"):
- Confidence + human-in-the-loop review queue - BUILT (surfaces low-confidence/Other items for
  correction or exclusion; edits are also applied to the export).
- Multi-label classification - BUILT (primary + secondary themes).

### Still open:
1. Multi-label evaluation. The multi-label pipeline ships but is not measured; needs a hand-labelled
   multi-label validation set.
2. Full taxonomy. Extend to all ~20 CFPB categories and report the accuracy drop honestly.
3. Persistence. Store analyses and corrections so trend/monitoring and review survive a session.
4. Multiple text columns and cross-segmentation. Handle multi-question surveys and two-dimensional
   breakdowns.
5. Second domain. Run on a non-financial dataset to test the "adapts without relabelling" claim
   empirically, not just by argument.
6. Multiple-comparisons correction and confidence calibration. 
