# Vercel と GitHub リポジトリの連携手順

## 1. GitHub との接続（ローカル）

すでに設定済みです。

- リモート: `origin` → https://github.com/alok0814/Polarity.git
- プッシュ: `git push origin main` で GitHub に反映

---

## 2. Vercel と GitHub リポジトリの連携（初回のみ）

Vercel のダッシュボードで「このリポジトリをデプロイする」ように連携します。

### 手順

1. **Vercel にログイン**  
   https://vercel.com にアクセスし、GitHub アカウントでログイン（または Sign up）。

2. **新規プロジェクト / Import**  
   - ダッシュボードで **「Add New…」→「Project」** をクリック  
   - または **「Import Project」** をクリック

3. **GitHub リポジトリを選択**  
   - 「Import Git Repository」で **GitHub** を選択  
   - 初回は **「Configure GitHub App」** や **「Grant Access」** で、Vercel にリポジトリへのアクセスを許可  
   - 一覧から **alok0814/Polarity** を選び **「Import」**

4. **プロジェクト設定**  
   - Framework Preset: **Next.js** のまま  
   - Root Directory: そのまま（空で OK）  
   - Environment Variables: 必要なら `OPENAI_API_KEY` などを追加  
   - **「Deploy」** をクリック

5. **完了**  
   - デプロイが終わると、`https://〇〇〇.vercel.app` のような URL が発行されます。  
   - 以降、**GitHub の main に push するたびに自動で Vercel が再デプロイ**します。

---

## 3. 既存の Vercel プロジェクトにリポジトリを連携し直す場合

すでに Vercel にプロジェクト（例: polariydemo）がある場合:

1. Vercel ダッシュボードでその **プロジェクト** を開く  
2. **Settings** → **Git**  
3. **Connected Git Repository** で、接続したいリポジトリ（alok0814/Polarity）が表示されているか確認  
4. 別のリポジトリに変えたい場合は「Disconnect」してから、上記「新規プロジェクト / Import」と同様に **Polarity** を Import し直す

---

## まとめ

- **ローカル ↔ GitHub**: すでに `origin` で連携済み  
- **GitHub ↔ Vercel**: Vercel の「Import Project」で **alok0814/Polarity** を選択して連携すると、push のたびに自動デプロイされます。
