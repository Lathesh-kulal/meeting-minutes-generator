from pipeline.action_items import _load_trained_model

clf, embedder = _load_trained_model()

test_sentences = [
    "So can I bring you in here, David?",
    "Any comments?",
    "Yes, go ahead.",
    "That was all useful information.",
    "David, could you look for a market research company we could work with on this?",
]

X = embedder.encode(test_sentences)
probs = clf.predict_proba(X)[:, 1]
for sentence, prob in zip(test_sentences, probs):
    print(f"{prob:.2f}  {sentence}")