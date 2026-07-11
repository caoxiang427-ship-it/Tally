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

## Next steps

1. **Multi-label evaluation.** Hand-label a small multi-label validation set so the
   multi-label pipeline (already built) can be measured, not just shipped.
2. **Full taxonomy.** Extend to all ~20 CFPB categories and report the accuracy drop
   honestly, to characterize how the approach scales with class count.
3. **Confidence + human-in-the-loop.** Surface per-label confidence and route low-confidence
   items for review — turns abstention into an actionable workflow.
4. **Second domain.** Run the pipeline on a non-financial dataset (e.g. app reviews) to
   test the "adapts without relabeling" claim empirically, not just by argument.
