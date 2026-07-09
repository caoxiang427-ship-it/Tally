# Running log of failures and oddities

A running log of bugs, unexpected behaviours, and identified limitations,
maintained from Day 3 onward rather than reconstructed at the end.

## Day 3 - Pipeline and dashboard

### [Fixed] Theme discovery reflected the sample rather than the dataset

An 8-comment sample containing mostly complaints produced an entirely
negative theme list. The 2 positive comments did not fit any discovered
theme and were classified as "Other." Theme quality therefore depends
on how representative the discovery sample is.

*Fix (Day 4):* Theme discovery now runs on several independent random samples
drawn from the full dataset before merging the resulting theme lists into a
single consensus list. Themes recurring across samples are treated as robust,
while one-off themes are treated as sample noise. Random sampling also replaced
the preivous "first N comments" approach, making discovered themes representative
of the dataset rather than its opening rows.

*Cost note:* This increases discovery from one API call to four. Since discovery
runs only once per upload, not once per comment. The additional cost is negligible
compared with per-comment classification. 

### Single-label classification oversimplifies multi-theme comments

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

### [Expected] Discovered themes may receive no assignments
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

*Fix (Day 4)*: Theme counts are now initialised to zero for every discovered theme,
ensuring that such themes appear as empty bars rather than disappearing entirely.
This accurately communicates that the topic exists in the feedback but is never the primary
concern of any single comment.

## Day 4 - Evaluation set and baselines

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

## Day 5 - (to be added)
