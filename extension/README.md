# Polarity AI — Chrome extension

Shows **reliability** (0–100) and **bias category** (Far Left … Far Right) for the active tab by calling your deployed Polarity app’s `POST /api/extension-analyze`.

## Setup

1. Deploy the **`frontend/`** Next.js app (or run `npm run dev` from repo root / `frontend`) with `GEMINI_API_KEY` in `frontend/.env.local`.
2. Open Chrome → **Extensions** → enable **Developer mode** → **Load unpacked** → select this `extension` folder.
3. Click **Options** on the extension and set **API base URL** to your site root (e.g. `https://your-project.vercel.app`), no trailing slash.
4. Open a news article, click the Polarity icon, then **Analyze this page**.

## API

The extension sends `{ "url": "<current tab URL>" }` to `{apiBaseUrl}/api/extension-analyze`.
