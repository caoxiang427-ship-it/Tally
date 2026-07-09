# Running log of failures and oddities

A running log of bugs, unexpected behaviours, and identified limitations,
maintained from Day 3 onward rather than reconstructed at the end.

## Day 3 - Pipeline and dashboard

**Theme discovery reflects the input sample**
An 8-comment sample containing mostly complaints produced an entirely
negative theme list. The 2 positive comments did not fit any discovered
theme and were classified as "Other." Theme quality therefore depends
on how representative the discovery sample is. This does not affect
the CFPB evaluation, where fixed categories are used, but remains a
limitation of the lived product.

**Single-label classification oversimplifies multi-theme comments**
A comment such as "The item arrived broken and returns were a nightmare"
was assigned only "Customer service issues" rather than "Damaged items."
The comment legitimately belongs to multiple themes, but the prompt enforces
exactly one label. This is a design trade-off rather than a bug, and causes
secondary concerns to be omitted from the theme counts.

**Theme discovery is not fully deterministic**
Running theme discovery twice on identical input produced different final themes
despite using temperature 0. Temperature 0 reduces variation but does not
eliminate it, reinforcing the need to measure run-to-run consistency explicitly.

**Discovered themes may receive no assignments**
In one run, "Poor communication" was discovered as a theme, yet no comments were 
ultimately classified into it. As a result, the theme appeared in the 
discovered theme list but not in the dashboard counts. The UI must therefore 
handle empty themes gracefully rather than assuming every discovered theme
will have associated comments.

## Day 4 - Evaluation set and baselines

**CFPB date field is inconsistent**
`Date received` column mixes plain dates (e.g., `2023-03-11`) with full ISO timestamps,
as well as timezone-naive and timezone-aware values. 
Parsing required `format="mixed", utc=True`, and the post-2017 filter had to use a
timezone-aware comparison. This reflects the messiness of real-world data rather than
a flaw in the pipeline.

**Complaint narratives are optional**
Most CFPB records contain no complaint narrative, leaving the text field empty. These
rows must be filtered out before sampling; otherwise, the evaluation set would contain
blank inputs that cannot be classified.

**`groupby` moved the grouping column into the index**
The initial class-balanced sampling implementation failed with `KeyError: ['label'] not in index`
because `groupby("Product")` moved `Product` into the index. Replaced the groupby
with an explicit per-category loop. 

**The keyword baseline is intentionally simplistic**
When no keyword matches, the baseline defaults to predicting "Credit reporting", the
largest class. This biases recall toward that category and prevents the model from abstaining on 
uncertain cases. As a result, it serves only as a deliberately weak lower bound,
motivating the inclusion of TF-IDF + Logistic Regression as a stronger and more 
credible baseline.
