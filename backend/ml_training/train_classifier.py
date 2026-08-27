"""
train_classifier.py
Trains the action-item classifier (TF-IDF + Logistic Regression baseline)
on the labeled dataset and saves it to saved_models/action_item_clf.pkl.
pipeline/action_items.py automatically picks this up once it exists.
"""
# TODO: load data/labeled/*.csv, vectorize with TfidfVectorizer,
# train LogisticRegression, joblib.dump({"classifier":..., "vectorizer":...}, ...)

if __name__ == "__main__":
    pass
