# Step 0: プロジェクトスキャフォールド

> **日程**: Day 1-3
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)

---

## 目標

デプロイ済みの空アプリケーション + Python Agent 開発環境の構築。
全後続ステップの土台となるインフラ・開発環境・テスト基盤を整える。

---

## 前提条件

- AWS アカウント（Bedrock $200 + AgentCore $200 クレジット取得済み）
- Node.js 20+, Python 3.12+, Docker
- AWS CLI v2 + CDK ブートストラップ済み
- Kiro IDE

---

## 成果物

### Amplify バックエンド（既存 — Step 0-1 として作成済み）

| ファイル | 内容 |
|---------|------|
| `amplify/custom/database/index.ts` | DatabaseConstruct — DynamoDB 8 テーブル |
| `amplify/custom/foundation/index.ts` | FoundationConstruct — S3 knowledge + ECR |
| `amplify/backend.ts` | defineBackend（Step 0-1 有効） |

### フロントエンド

| ファイル / ディレクトリ | 内容 |
|----------------------|------|
| `src/app/layout.tsx` | Next.js 14 App Router ルートレイアウト |
| `src/app/page.tsx` | トップページ（プレースホルダー） |
| `next.config.js` | Next.js 設定（Serwist 統合含む） |
| `public/manifest.json` | PWA マニフェスト |
| `src/sw.ts` | Serwist Service Worker 登録 |
| `tailwind.config.ts` | Tailwind CSS 設定 |
| `components.json` | shadcn/ui 設定 |

### Python Agent 環境

| ファイル / ディレクトリ | 内容 |
|----------------------|------|
| `agents/pyproject.toml` | Python 依存管理（uv） |
| `agents/Dockerfile` | ARM64 コンテナ（AgentCore 用） |
| `agents/tic_labeling/` | Tic Labeling Agent ディレクトリ（空） |
| `agents/micro_guide/` | Micro-Guide Agent ディレクトリ（空） |
| `agents/tests/` | pytest テストディレクトリ |

### テスト・開発ツール

| ファイル | 内容 |
|---------|------|
| `vitest.config.ts` | Vitest 設定 |
| `playwright.config.ts` | Playwright 設定 |
| `.eslintrc.cjs` | ESLint 設定 |
| `.prettierrc` | Prettier 設定 |

---

## 作業内容

### 1. Next.js 14 + Amplify Gen 2 セットアップ

```bash
# Next.js プロジェクト初期化（amplify/ は作成済み）
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
```

- App Router を使用
- `src/` ディレクトリ構成
- TypeScript strict モード

### 2. Serwist PWA 設定

> 参照: `architecture_final.md` §4.1, §4.5

```bash
npm install @serwist/next serwist
```

- `public/manifest.json` に `name: "TicTrack"`, `short_name: "TicTrack"`, `start_url: "/"`, `display: "standalone"` を設定
- `src/sw.ts` で Service Worker 登録
- `next.config.js` に `withSerwist()` ラッパー追加

### 3. Tailwind CSS + shadcn/ui セットアップ

```bash
npx shadcn@latest init
```

- Tailwind v4 と shadcn/ui の互換性を確認（問題あれば v3 固定）
- テーマカラーの基本設定

### 4. テスト基盤セットアップ（Node.js）

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright @playwright/test
```

- `vitest.config.ts` でカバレッジ設定
- `playwright.config.ts` で基本設定

### 5. Linter / Formatter 設定

```bash
npm install -D eslint prettier eslint-config-prettier
```

### 6. Python 3.12 + uv セットアップ

```bash
# agents/ ディレクトリで uv プロジェクト初期化
cd agents
uv init
uv add strands-agents strands-agents-tools
uv add --dev pytest moto boto3
```

- `agents/pyproject.toml` に依存関係定義
- `agents/tic_labeling/`, `agents/micro_guide/`, `agents/tests/` ディレクトリ作成

### 7. Docker + ECR セットアップ

> 参照: `architecture_final.md` §8.5

```dockerfile
# agents/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY . .
EXPOSE 8080
CMD ["uvicorn", "tic_labeling.agent:app", "--host", "0.0.0.0", "--port", "8080"]
```

- ARM64 ターゲットでビルド確認
- ECR リポジトリは `amplify/custom/foundation/index.ts` で作成済み

### 8. Amplify Sandbox デプロイ

```bash
npx ampx sandbox
```

- DynamoDB 8 テーブルが作成されること確認
- S3 knowledge バケット + ECR リポジトリが作成されること確認
- デプロイ URL でアクセス可能であること確認

---

## TDD テスト項目

- [ ] `npm run build` がエラーなしで完了すること
- [ ] デプロイ URL にアクセスして HTTP 200 が返ること
- [ ] PWA マニフェストの `name`, `short_name`, `start_url`, `display` が正しく設定されていること
- [ ] Service Worker が正常に登録されること
- [ ] DynamoDB テーブルが全 8 テーブル作成されていること（GSI 含む）
- [ ] S3 バケットがパブリックアクセスブロック有効で作成されていること
- [ ] Python 3.12 環境で `strands-agents` がインポートできること
- [ ] Docker ビルドが成功すること（ARM64 ターゲット）
- [ ] ECR リポジトリが作成されていること

---

## 完了基準

- ブラウザでアクセス可能なデプロイ済み空アプリ（PWA マニフェスト付き）
- Python Agent 開発環境（strands-agents インストール済み）
- テスト基盤（Vitest + pytest）セットアップ完了
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 1: 認証 + ユーザー/子どもプロフィール](../step1/README.md)
