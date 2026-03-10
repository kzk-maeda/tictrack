# TicTrack プロジェクト構造

## ルートディレクトリ構造

```
/
├── .amplify/              # Amplify Sandbox 作業ディレクトリ（git ignore）
├── .claude/               # Claude Code 設定・メモリ・タスク
├── .git/                  # Git リポジトリ
├── .github/               # GitHub Actions ワークフロー
├── .next/                 # Next.js ビルド出力（git ignore）
├── .pytest_cache/         # Pytest キャッシュ（git ignore）
├── .vscode/               # VS Code 設定
├── agents/                # Python AI Agents（Strands SDK）
│   ├── tic_labeling/     # Tic Labeling Agent
│   ├── micro_guide/      # Micro-Guide Agent
│   ├── tests/            # Agent テスト
│   └── pyproject.toml    # Python 依存関係（uv）
├── amplify/               # AWS Amplify Gen 2 設定
│   ├── backend.ts        # Backend 定義
│   ├── custom/           # カスタム CDK Construct
│   │   ├── database/     # DynamoDB テーブル定義
│   │   ├── foundation/   # S3, ECR 基盤リソース
│   │   ├── api/          # REST API 定義
│   │   └── orchestration/ # Step Functions 定義
│   └── functions/        # Lambda 関数
│       ├── api-handler/  # CRUD API Lambda
│       └── agentcore-proxy/ # AgentCore 呼び出し Lambda
├── docs/                  # ドキュメント
│   ├── adr/              # Architecture Decision Records
│   ├── design/           # 設計ドキュメント
│   ├── steps/            # 実装ステップガイド
│   └── troubleshooting/  # トラブルシューティング
├── e2e/                   # ✅ Playwright E2E テスト（正しい位置）
│   └── *.spec.ts
├── messages/              # ✅ next-intl 翻訳ファイル（正しい位置）
│   ├── ja.json           # 日本語（デフォルト）
│   └── en.json           # 英語
├── node_modules/          # Node.js 依存関係（git ignore）
├── public/                # 静的アセット
│   ├── icons/            # PWA アイコン
│   ├── sw.js             # Service Worker
│   └── manifest.json     # PWA Manifest（動的生成）
├── src/                   # Next.js アプリケーション
│   ├── app/              # App Router ページ
│   ├── components/       # React コンポーネント
│   ├── lib/              # ユーティリティ・API クライアント
│   ├── i18n.ts           # next-intl 設定
│   └── middleware.ts     # Next.js Middleware（i18n）
├── package.json           # Node.js 依存関係・スクリプト
├── playwright.config.ts   # Playwright 設定
├── next.config.mjs        # Next.js 設定
├── vitest.config.ts       # Vitest 設定
└── tsconfig.json          # TypeScript 設定
```

---

## 重要なディレクトリの配置根拠

### ✅ `/e2e` - ルートレベル（正しい）

**理由**:
- Playwright の標準的な配置
- `playwright.config.ts` で `testDir: "./e2e"` と参照
- `vitest.config.ts` で `exclude: ["**/e2e/**"]` として unit test から除外
- Next.js プロジェクトの一般的な慣習

**参考**:
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- Next.js 公式例: `examples/with-playwright/e2e/`

---

### ✅ `/messages` - ルートレベル（正しい）

**理由**:
- ADR 007 で明示的に決定（`docs/adr/007-adopt-next-intl-for-i18n.md`）
- `src/i18n.ts` で `await import(\`../messages/${locale}.json\`)` と参照
- next-intl の推奨構造（ルートまたは src/ の両方が可能）

**next-intl の公式推奨構造**:
```
Option 1 (採用):
/messages
  /ja.json
  /en.json

Option 2 (代替案):
/src/messages
  /ja.json
  /en.json
```

**現在の実装**:
- `src/i18n.ts:15` で `../messages/${locale}.json` を読み込み
- `src/lib/__tests__/i18n.test.ts` でも `../../../messages/ja.json` を参照
- ルートレベルの方がシンプルで、テストコードからもアクセスしやすい

---

## 他のディレクトリ配置の確認

### ✅ `/agents` - ルートレベル（正しい）

**理由**:
- Python プロジェクト（独立した pyproject.toml）
- Next.js アプリケーションとは別言語
- Docker イメージとしてビルドされる（AgentCore Runtime へデプロイ）

### ✅ `/amplify` - ルートレベル（正しい）

**理由**:
- Amplify Gen 2 の標準構造
- CDK ベースのインフラ定義
- Next.js アプリとは独立したデプロイメント

### ✅ `/docs` - ルートレベル（正しい）

**理由**:
- プロジェクト全体のドキュメント
- ADR、設計書、トラブルシューティングガイド
- アプリケーションコードではない

### ✅ `/src` - Next.js App Router（正しい）

**理由**:
- Next.js 14+ の推奨構造
- `/app`（App Router）を含む
- TypeScript ソースコード全体

---

## ディレクトリ名の妥当性

| ディレクトリ | 名前 | 妥当性 | 代替案 | 備考 |
|------------|------|--------|--------|------|
| `/e2e` | ✅ 正しい | 標準的 | `/tests/e2e` | Playwright の慣習 |
| `/messages` | ✅ 正しい | 標準的 | `/locales`, `/i18n`, `/translations` | next-intl のデフォルト |
| `/agents` | ✅ 正しい | 明確 | - | Python AI エージェント |
| `/amplify` | ✅ 正しい | 公式 | - | Amplify Gen 2 の標準 |
| `/docs` | ✅ 正しい | 標準的 | `/documentation` | 一般的な慣習 |
| `/src` | ✅ 正しい | 標準的 | - | Next.js の推奨 |
| `/public` | ✅ 正しい | 標準的 | - | Next.js の標準 |

---

## 結論

**現在の構造は全て正しいです。**

- ✅ `/e2e` - Playwright テストの標準配置
- ✅ `/messages` - next-intl の推奨構造（ADR 007 で決定済み）
- ✅ ディレクトリ名も業界標準に準拠

変更の必要はありません。
