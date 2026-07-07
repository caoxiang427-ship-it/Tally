# Success Criteria

## Overview
This document defines how Tally's success is measured, and is committed before any results exist.
Tally turns open-ended feedback (e.g., survey responses, reviews, complaints) into a
structured summary: a fixed set of themes, a sentiment label per comment, and counts.
The claim being tested is deliberately narrow: that this can be done accurately, consistently,
and cheaply. Each of those is tied to a specific number and a baseline rather than asserted,
and the targets are fixed up front so the evaluation is a fair test.

## Dataset

Ground truth comes from the **CFPB Consumer Complaint Database**, a U.S. government dataset.
Each record contains a consumer's free-text complaint (the model's input) and a 
human-assigned category (the correct answer to check against). It is public domain and
downloadable as CSV/JSON, so building a labeled test set is straightforward.

Two constraints are applied to keep the labels clean:

- **Post-April-2017 only.** The CFPB revised its product and issue categories in April 2017,
  so records spanning that change carry conflicting category names. Using only later data
  avoids this.
- **Class-balanced evaluation set.** The distribution is heavily skewed (credit reporting
  dominates), so a random sample would let a majority-class guesser appear strong. The
  evaluation set draws roughly equal numbers from a fixed set of `[Credit reporting,
  Debt collection, Mortgage, Credit card, Checking or saving account, and Student loan]`, 
  which is also why the primary metric is macro-F1, not plain accuracy.

## 1. Accuracy vs. human labels

Measured on a held-out, class-balanced sample of ~300-500 complaints, reported as
two numbers:

- **Macro-F1**: weights every category equally, so class imbalance cannot inflate the result.
- **Cohen's κ**: agreement with the human labels, corrected for chance.

Targets:

- **Floor:** κ ≥ 0.61, corresponding to "substantial" agreement on the Landis & Koch (1977)
  scale (0.41-0.60 is only "moderate").
- **Value-add bar:** exceed the keyword baseline by ≥ 0.10 macro-F1. Keyword matching fails
  on paraphrase (e.g. "can't pay" vs. "struggling with payments"), so clearing this margin
  shows the model adds real value.

## 2. Consistency across runs

The same inputs are classified three times at temperature 0, targeting **≥ 95% identical
labels across runs**. Because LLM outputs are produced by probabilistic sampling, run-to-run
consistency is not guaranteed even at low temperature. Tally measures this explicitly rather
than assumed.

## 3. Cost

Target: the per-comment cost must be a small fraction of the equivalent human labeling
effort. Cost is computed from the model's current per-token price and measured token usage
per comment, reported as **cost per 1,000 comments**. A cheap-model vs. frontier-model
comparison is included to show the trade-off.

Cost is measured on gpt-5.4-mini ($0.75 per 1M input tokens, $4.50 per 1M output), 
using the token counts the API reports. Committed ceiling: **under $1 per 1,000**. A run 
on a stronger model (gpt-5.4, $2.50/$15) shows the accuracy-vs-cost trade-off. Both are far
cheaper than an analyst, who needs several hours to hand-label 1,000 complaints.

## 4. Latency

Reported as median seconds per comment and total time to process 1,000 comments, with a
target on the order of a few minutes per 1,000. Reported as evidence of throughput awareness
rather than a pass/fail gate.

## 5. Scope

Theme classification is evaluated against CFPB's human labels. Sentiment is produced as an
illustrative feature and is not formally evaluated, as no labeled sentiment ground truth
is used.
