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

## Action-item detection with a local LLM (this version)

Action items are now extracted by a free, local LLM through
[Ollama](https://ollama.com) - no API key, no cost, nothing leaves your machine.

```bash
# 1. Install Ollama from https://ollama.com, then pull a model:
ollama pull qwen2.5:7b        # ~4.7 GB, default model, needs ~8 GB RAM
# weaker machine? use the lighter (less accurate) model instead:
#   ollama pull qwen2.5:3b   and set OLLAMA_MODEL=qwen2.5:3b

# 2. (optional) choose the model / server
export OLLAMA_MODEL=qwen2.5:7b          # optional - 7b is already the default
export ACTION_ITEM_BACKEND=auto         # auto | llm | classifier | rules

# 3. install the one new dependency and run as usual
pip install -r requirements.txt
python run.py
```

`auto` (default) tries the LLM first and silently falls back to the trained
classifier, then to the rule-based heuristic if Ollama isn't running.
Each action item has `method` = `llm` / `trained` / `rule_based`, so you can
see which backend produced it. LLM items also carry `task`, `assigned_to`
and `due_date` resolved from dialogue context.

Compare backends on labeled meetings (add your own to
`backend/ml_training/data/eval/meeting_eval.txt`):
```bash
cd backend
python -m ml_training.eval_action_items
pytest tests -q
```

## Status
Skeleton scaffold. `pipeline/` core modules (preprocess, segment,
action_items, ner_utils) are written and tested. Everything else
(Flask routes, DB models, React pages/components, exports, ML training
scripts, translation) is stubbed with TODOs — see project_blueprint.md
for the full build plan and recommended order.
