# Polarity

Layout aligned with [pthaps/polarity-v2](https://github.com/pthaps/polarity-v2): **`frontend/`**, **`backend/`**, **`extension/`**, **`docs/`**.

## Repository layout

| Folder | Purpose |
|--------|---------|
| [`frontend/`](frontend/) | Next.js 14 app — UI, `/api/analyze`, `/api/fetch-news`, `/api/extension-analyze` |
| [`backend/`](backend/) | Placeholder for a future standalone API (see `backend/README.md`) |
| [`extension/`](extension/) | Chrome extension (bias + reliability via your deployed site) |
| [`docs/`](docs/) | Documentation (e.g. system flow) |

## Quick start

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev
```

Or from the repo root:

```bash
npm run install:all
cd frontend && cp .env.example .env.local   # edit with your keys
npm run dev
```

Open **http://localhost:3000**.

## Vercel

Set the project **Root Directory** to **`frontend`** so builds use `frontend/package.json`.

## Environment

See [`frontend/.env.example`](frontend/.env.example) — `GEMINI_API_KEY` is required for analysis.

## Ad Fontes data

Outlet baselines ship with the app as [`frontend/src/data/ad-fontes-media.csv`](frontend/src/data/ad-fontes-media.csv). A copy of the source chart CSV may also live under `docs/` for reference.
