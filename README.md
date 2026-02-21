# FactCheck Debate

政治ニュースのURLを入力すると、7体のAIエージェントが多角的に議論・分析するWebアプリです。

## エージェント

- **Progressive Perspective** — 社会正義・平等の視点
- **Conservative Perspective** — 伝統・秩序の視点
- **Devil's Advocate** — 懐疑的・批判的思考
- **Bias Analyst** — メディア・バイアス分析
- **Fact-Checker** — ファクトチェック
- **The Synthesizer** — 客観的統合・比較表
- **The Pragmatist** — 実務的・中道の分析

## セットアップ

1. 依存関係のインストール  
   `npm install --legacy-peer-deps`

2. 環境変数  
   `.env.local` に以下を設定（またはそのまま利用）:
   - `GEMINI_API_KEY` — Gemini API
   - `SUPABASE_URL` / `SUPABASE_KEY` — 分析履歴保存（任意）
   - `FACTCHECK_API_KEY` — 将来のファクトチェックAPI用（任意）

3. Supabase で履歴を保存する場合  
   `supabase-migration.sql` を Supabase の SQL Editor で実行してテーブルを作成してください。

## 起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開き、ニュースのURLを入力して「分析する」をクリックしてください。

## 技術スタック

- Next.js 14 (App Router)
- Gemini API (@google/genai)
- Cheerio（URL本文取得）
- Supabase（分析履歴・任意）
- Tailwind CSS
