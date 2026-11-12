# AI-Powered Meeting Minutes Generator

MCA final-year project. It turns a meeting recording or transcript into structured minutes: a title, key points, chapter summaries, and action items with owners and due dates. Everything runs locally on one machine, so no meeting audio or text is sent to a cloud service.

## Features

- **Inputs:** audio or video upload, live recording in the browser (online meeting or microphone), pasted transcript, `.txt` transcript upload (for example a Zoom or Teams export).
- **Outputs:** Highlights view (key points) and Chapters view (topic-based chapters with summaries), plus an action-items table with assignee and due date.
- **Accounts and history:** register and log in; each user sees only their own meetings. Search, rename, delete and bulk-delete in the History page.
- **Export:** PDF (default) and DOCX, in English, Hindi, Spanish, Telugu, Malayalam or Kannada. Person names are protected during translation.
- **Background processing:** meetings are processed in a background job with a status page, and jobs interrupted by a crash are marked failed on startup.

## How it works

```
audio / video / live recording ──> Whisper ──┐
pasted text / .txt transcript ───────────────┤
                                             v
                                   Preprocessing (clean, split sentences, speaker per sentence)
                                    │                                │
                                    v                                v
                     TextTiling topic segmentation          Action-item extraction
                                    │                    (LLM -> classifier -> rules)
                                    v                                │
                     BART chapter summaries + titles                 │
                                    │                                │
                     key points from chapter summaries               │
                                    └──────────────┬─────────────────┘
                                                   v
                              NER (spaCy), grounding check, owners from speaker labels
                                                   v
                                         SQLite history ──> PDF / DOCX export (+ translation)
```

| Stage | Tool |
| --- | --- |
| Speech recognition | OpenAI Whisper (`base`) |
| Topic segmentation | NLTK TextTiling |
| Chapter summaries | `facebook/bart-large-cnn` |
| Key-point ranking | sentence-transformers `all-MiniLM-L6-v2` |
| Action items | Local LLM (Ollama, `qwen2.5:7b`), then MiniLM + logistic regression, then rules |
| Names and dates | spaCy `en_core_web_sm` with a name gazetteer and regex fallback |
| Translation | Helsinki-NLP OPUS-MT |
| Export | WeasyPrint (PDF), python-docx (DOCX) |

Key points are chosen from the chapter summaries: sentences are cleaned and filtered, ranked by similarity to the meeting's overall meaning, and picked round-robin so every chapter is covered (up to 10 points, 12 for very long meetings). Action items from the LLM must quote the transcript, and items not supported by the transcript are dropped.

## Structure

- `backend/` - Flask REST API and the NLP pipeline
  - `app/` - application factory, models, routes (auth, upload, status, results, history, export)
  - `pipeline/` - `preprocess.py`, `summarize.py`, `action_items.py`, `llm_action_items.py`, `ner_utils.py`, `owners.py`, `translate.py`, `pipeline_runner.py`
  - `exports/` - PDF and DOCX export
  - `ml_training/` - dataset preparation, classifier training and evaluation scripts
  - `tests/` - unit and API tests
- `frontend/` - React (Vite) UI

## Getting started

Python 3.12 is recommended.

### Prerequisites

- **ffmpeg** on your PATH (needed by Whisper).
- **Windows only:** the GTK3 runtime for WeasyPrint PDF export; `pydyf<0.11.0` is pinned for compatibility.
- **Ollama** for LLM action-item extraction (see below). The app still works without it.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
python run.py
```

Models (Whisper, BART, MiniLM, OPUS-MT) download on first use. Set `HF_HOME` to move the Hugging Face cache to a drive with more space.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173), register an account, and upload or record a meeting.

## Action-item detection

Action items are extracted by a local LLM through [Ollama](https://ollama.com). There is no API key and no cost, and nothing leaves your machine.

```bash
# 1. Install Ollama, then pull a model
ollama pull qwen2.5:7b        # about 4.7 GB, default, needs about 8 GB RAM
# weaker machine? use ollama pull qwen2.5:3b and set OLLAMA_MODEL=qwen2.5:3b
# (the 3B model is faster but noticeably less accurate)

# 2. Optional settings
export OLLAMA_MODEL=qwen2.5:7b          # 7b is already the default
export ACTION_ITEM_BACKEND=auto         # auto | llm | classifier | rules
```

`auto` (default) tries the LLM first, then falls back to the trained classifier, then to the rule-based heuristic if Ollama is not running. Each item has a `method` of `llm`, `trained` or `rule_based`. LLM items also carry `task`, `assigned_to` and `due_date`.

### Training the fallback classifier

The classifier is MiniLM sentence embeddings with logistic regression, trained on the public [kiransarv/actionitemdetection](https://github.com/kiransarv/actionitemdetection) dataset plus a small set of meeting-style examples (`meeting_discourse_augmentation.tsv`) that is oversampled in the training split only.

```bash
cd backend
# save the raw dataset as ml_training/data/raw/action_items_dataset.tsv first
python -m ml_training.prepare_dataset
python -m ml_training.train_classifier
```

Train inside the same virtual environment you run the app in, so the scikit-learn versions match.

### Evaluating and testing

Compare the backends on labelled meetings (add your own to `backend/ml_training/data/eval/meeting_eval.txt`):

```bash
cd backend
python -m ml_training.eval_action_items
pytest tests -q
```

## Results so far

Measured on a CPU-only laptop. These are observations on a few real inputs, not large-scale statistics.

| Measurement | Result |
| --- | --- |
| Classifier (MiniLM + logistic regression), held-out test | about 96% accuracy |
| Local LLM (qwen2.5:7b), small benchmark of 9 gold items | precision 1.00, recall 1.00 |
| Whisper `base`, 65 s of audio | 10.3 s |
| Full pipeline on a real meeting | about 61 s (LLM step 34.3 s) |

## Known limitations

- Audio recordings carry no speaker labels, so owners from speaker names work only for labelled transcripts.
- Compound tasks ("do X and Y") are not split into separate items.
- Accuracy drops with accents, overlapping speech and poor audio; Whisper word error rate has not been measured yet.
- Translation of technical terms is weak with the small OPUS-MT models.
- Processing is batch-based, not real time.
- The LLM benchmark is small; a larger labelled set is still needed.

## Roadmap

- Real-room test of the in-person (microphone) recording mode.
- Whisper word error rate and a larger action-item benchmark.
- Splitting compound tasks and speaker identification for audio.
- Timing on a GPU machine.