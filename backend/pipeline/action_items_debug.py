from action_items import _load_trained_model

clf, vectorizer = _load_trained_model()

test_sentences = [
    "So can I bring you in here, David?",
    "Any comments?",
    "Yes, go ahead.",
    "That was all useful information.",
    "David, could you look for a market research company we could work with on this?",  # a genuine one
]

X = vectorizer.transform(test_sentences)
probs = clf.predict_proba(X)[:, 1]  # probability of class 1 (ACTION)
for sentence, prob in zip(test_sentences, probs):
    print(f"{prob:.2f}  {sentence}")