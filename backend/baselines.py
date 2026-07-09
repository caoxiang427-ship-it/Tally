import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_predict

df = pd.read_csv("data/eval_set.csv")

# Baseline 1:
KEYWORDS = {
    "Credit reporting, credit repair services, or other personal consumer reports":
        ["credit report", "credit bureau", "equifax", "experian", "transunion"],
    "Debt collection": ["debt collector", "collection agency", "collect"],
    "Mortgage": ["mortgage", "foreclosure", "escrow"],
    "Credit card or prepaid card": ["credit card", "prepaid card"],
    "Checking or savings account": ["checking account", "savings account", "overdraft"],
    "Student loan": ["student loan", "navient", "tuition"],
}

def keyword_predict(text):
    t = text.lower()
    for label, words in KEYWORDS.items():
        if any(w in t for w in words):
            return label
    return "Credit reporting, credit repair services, or other personal consumer reports" # fallback

df["pred_keyword"] = df["text"].apply(keyword_predict)

# Baseline 2:
# Convert text into numbers
vec = TfidfVectorizer(
    max_features=5000, # keep only 5000 most useful words
    stop_words="english", # ignore common English words like "the", "is", "a"...
    ngram_range=(1, 2))   # use both 1-word + 2-word phrases

X = vec.fit_transform(df["text"])

# Classifier: logistic regression model
clf = LogisticRegression(max_iter=1000, class_weight="balanced")

# 5-fold cross validation 
df["pred_tfidf"] = cross_val_predict(clf, X, df["label"], cv=5)

df.to_csv("data/predictions_baselines.csv", index=False)
print("Saved baseline predictions.")
