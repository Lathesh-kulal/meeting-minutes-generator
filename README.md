# AI-Powered Meeting Minutes Generator

MCA Final Year Project — converts meeting audio/video/transcripts into
structured, dual-view (Highlights + Chapters) minutes, with a trained
action-item classifier and multilingual export.

## Structure
- `backend/` — Flask REST API + NLP pipeline (Whisper, BART/T5, spaCy, scikit-learn)
- `frontend/` — React (Vite) UI

## Getting started

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python run.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Status
Skeleton scaffold. `pipeline/` core modules (preprocess, segment,
action_items, ner_utils) are written and tested. Everything else
(Flask routes, DB models, React pages/components, exports, ML training
scripts, translation) is stubbed with TODOs — see project_blueprint.md
for the full build plan and recommended order.
