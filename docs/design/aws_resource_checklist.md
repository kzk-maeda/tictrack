# TicTrack AWS リソース・設定チェックリスト

> **目的**: 実装開始前に AWS コンソール / CLI で作成・設定すべきリソースの完全一覧
> **参照**: `architecture_final.md`（最終アーキテクチャ設計書）
> **リージョン**: `us-east-1`（A7 — シングルリージョン）
> **最終更新**: 2026-03-06

---

## 0. アカウント・クレジット（最優先）

| # | リソース / 設定 | 詳細 | ステータス |
|---|----------------|------|-----------|
| 0-1 | AWS アカウント作成 | 新規アカウントで $100 サインアップクレジットを取得 | [ ] |
| 0-2 | Bedrock Free Tier クレジット ($200) | Bedrock Playground でアクティビティ完了 → 追加 $100。合計 $200 | [ ] |
| 0-3 | AgentCore Free Tier クレジット ($200) | 新規ユーザー向け $200 クレジット（Bedrock とは別枠） | [ ] |
| 0-4 | Bedrock モデルアクセス有効化 | us-east-1 で以下のモデルへのアクセスをリクエスト（Bedrock コンソール → Model access）: | [ ] |
|     | | - Amazon Nova Pro (`amazon.nova-pro-v1:0`) | |
|     | | - Claude 3.5 Haiku (`anthropic.claude-3-5-haiku-20241022-v1:0`) | |
|     | | - Amazon Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`) | |
| 0-5 | AWS CLI v2 インストール | ローカル開発環境に CLI をセットアップ | [ ] |
| 0-6 | IAM ユーザー / SSO 設定 | 開発用の権限設定（AdministratorAccess — プロトタイプ限定） | [ ] |

---

## 1. Amplify Gen 2 / フロントエンド

| # | リソース / 設定 | 詳細 | Step |
|---|----------------|------|------|
| 1-1 | Amplify Gen 2 アプリ作成 | `amplify init` + GitHub リポジトリ連携 | Step 0 |
| 1-2 | Amplify Hosting | ブランチ自動デプロイ（`main` → 本番、`dev` → 開発） | Step 0 |
| 1-3 | Amplify ビルド設定 | Node.js 20 ランタイム。`amplify.yml` にビルドコマンド定義 | Step 0 |
| 1-4 | カスタムドメイン（任意） | Amplify Hosting のデフォルトドメインで十分。必要なら Route 53 連携 | Step 8 |

---

## 2. 認証 — Amazon Cognito

| # | リソース / 設定 | 詳細 | Step |
|---|----------------|------|------|
| 2-1 | Cognito User Pool | `amplify/auth/resource.ts` で `defineAuth` 定義。メール/パスワード認証 | Step 1 |
| 2-2 | User Pool 設定 | パスワードポリシー: 最小8文字、大文字/小文字/数字/記号 | Step 1 |
| 2-3 | MFA | プロトタイプでは無効（将来拡張） | Step 1 |
| 2-4 | COPPA 同意属性 | カスタム属性 `custom:coppa_consent` (Boolean) をスキーマに追加 | Step 1 |
| 2-5 | Cognito Identity Pool | S3 直接アップロード用。Amplify Storage が自動生成 | Step 1 |

---

## 3. API — Amazon API Gateway

| # | リソース / 設定 | 詳細 | Step |
|---|----------------|------|------|
| 3-1 | REST API 作成 | Amplify Gen 2 経由で自動生成（`amplify/backend.ts`） | Step 1 |
| 3-2 | Cognito Authorizer | User Pool Authorizer を API Gateway に設定 | Step 1 |
| 3-3 | CORS 設定 | Amplify Hosting ドメインのみ許可 | Step 1 |
| 3-4 | レート制限 | デフォルト（Free Tier: 100万リクエスト/月） | Step 1 |
| 3-5 | `/shared/*` パス | 認証不要エンドポイント（共有レポート/動画用） | Step 6 |

---

## 4. コンピュート — AWS Lambda

| # | リソース / 設定 | 詳細 | Step |
|---|----------------|------|------|
| 4-1 | **api-handler** Lambda | Node.js 20。CRUD API 全般。メモリ 256MB、タイムアウト 30秒 | Step 1 |
| 4-2 | **ai-proxy** Lambda | Node.js 20。AgentCore HTTP 呼び出しプロキシ。メモリ 256MB、タイムアウト 120秒（Agent 実行待ち） | Step 4 |
| 4-3 | **report-generator** Lambda | Node.js 20 + strands inline (Python Layer)。メモリ 512MB、タイムアウト 300秒 | Step 6 |
| 4-4 | **data-deletion** Lambda | Node.js 20。カスケード削除処理。メモリ 256MB、タイムアウト 300秒 | Step 8 |
| 4-5 | 環境変数 (共通) | `DYNAMODB_TABLE_PREFIX`, `S3_MEDIA_BUCKET`, `S3_KNOWLEDGE_BUCKET`, `REGION` | Step 0 |
| 4-6 | 環境変数 (ai-proxy) | `AGENTCORE_ENDPOINT` — AgentCore Runtime の `/invocations` URL | Step 4 |

---

## 5. AI Agent — AgentCore + ECR

| # | リソース / 設定 | 詳細 | Step |
|---|----------------|------|------|
| 5-1 | ECR リポジトリ作成 | `tictrack-agents` — Docker イメージ格納用 | Step 0 |
| 5-2 | Docker イメージビルド | `agents/Dockerfile` — Python 3.12-slim、ARM64 ターゲット | Step 0 |
| 5-3 | AgentCore CLI インストール | `pip install bedrock-agentcore-cli` | Step 0 |
| 5-4 | AgentCore Runtime 作成 | CLI: `agentcore runtime create --name tictrack-agents` | Step 4 |
| 5-5 | AgentCore Runtime デプロイ | ECR イメージ → AgentCore にデプロイ。vCPU / メモリ設定 | Step 4 |
| 5-6 | AgentCore エンドポイント確認 | `/invocations` と `/ping` の疎通テスト | Step 4 |
| 5-7 | AgentCore IAM ロール | Bedrock (Nova Pro, Claude, Guardrails, KB), DynamoDB, S3, Transcribe へのアクセス権限 | Step 4 |

---

## 6. ストレージ — Amazon DynamoDB

### テーブル一覧（8 テーブル）

| # | テーブル名 | PK | SK | GSI | TTL | Step |
|---|-----------|----|----|-----|-----|------|
| 6-1 | `Users` | `userId` (S) | — | — | — | Step 0 |
| 6-2 | `Children` | `childId` (S) | — | `userId-index` (PK: `userId`, SK: `createdAt`) | — | Step 0 |
| 6-3 | `TicCards` | `cardId` (S) | — | `childId-index` (PK: `childId`, SK: `createdAt`) | — | Step 0 |
| 6-4 | `Episodes` | `episodeId` (S) | — | `childId-occurredAt-index` (PK: `childId`, SK: `occurredAt`) | — | Step 0 |
| 6-5 | `AILabels` | `episodeId` (S) | `version` (N) | — | — | Step 0 |
| 6-6 | `CheckIns` | `checkInId` (S) | — | `childId-weekStart-index` (PK: `childId`, SK: `weekStart`) | — | Step 0 |
| 6-7 | `WeeklyReports` | `reportId` (S) | — | `childId-weekStart-index` (PK: `childId`, SK: `weekStart`) | — | Step 0 |
| 6-8 | `ShareTokens` | `shareToken` (S) | — | — | `TTL` 属性で自動削除 | Step 0 |

### 共通設定

| 項目 | 設定 |
|------|------|
| キャパシティモード | オンデマンド（Free Tier: 25 WCU / 25 RCU） |
| 暗号化 | デフォルト（AWS 管理キー） |
| Point-in-Time Recovery | 無効（プロトタイプ） |
| テーブル名プレフィックス | `tictrack-{env}-` (dev / prod) |

---

## 7. ストレージ — Amazon S3

| # | バケット名 | 用途 | 設定 | Step |
|---|-----------|------|------|------|
| 7-1 | `tictrack-media-{env}` | 動画 / レポート PDF | 下記参照 | Step 0 |
| 7-2 | `tictrack-knowledge-{env}` | マイクロガイドナレッジ | 下記参照 | Step 0 |

### バケット共通設定

| 項目 | 設定 |
|------|------|
| パブリックアクセスブロック | **全てブロック** |
| 暗号化 | SSE-S3（デフォルト暗号化） |
| バージョニング | 無効 |
| リージョン | us-east-1 |

### `tictrack-media-{env}` 追加設定

| 項目 | 設定 |
|------|------|
| CORS | Amplify Hosting ドメインからの PUT/GET を許可 |
| ライフサイクルルール 1 | `videos/` プレフィックス → 90 日後に S3 Glacier Flexible Retrieval |
| ライフサイクルルール 2 | `tmp/` プレフィックス → 1 日後に削除 |
| Presigned URL 用 IAM | Lambda ロール + Cognito Identity Pool |

### `tictrack-knowledge-{env}` 追加設定

| 項目 | 設定 |
|------|------|
| アクセス | Knowledge Bases サービスロール + AgentCore IAM ロールのみ |
| 初期コンテンツ | `micro-guides/` に 3〜5 本のキュレーション済み記事をアップロード（Step 7） |

---

## 8. AI/ML — Amazon Bedrock

### モデルアクセス（§0-4 で有効化済み前提）

| # | 設定 | 詳細 | Step |
|---|------|------|------|
| 8-1 | Bedrock Guardrails 作成 | Guardrail 名: `tictrack-non-diagnostic` | Step 4 |
|     | | Content filters: diagnosis, treatment_advice, causal_claims, prognosis を BLOCK | |
|     | | Denied topics 定義 | |
|     | | Word filters: 断定的表現のブロックリスト | |
| 8-2 | Guardrails バージョン発行 | 作成後にバージョンを発行し、ARN を取得 | Step 4 |
| 8-3 | Knowledge Bases 作成 | KB 名: `tictrack-micro-guides` | Step 7 |
|     | | Data Source: `s3://tictrack-knowledge-{env}/micro-guides/` | |
|     | | Vector Store: **S3 Vectors** | |
|     | | Embedding Model: Amazon Titan Text Embeddings V2 | |
|     | | Chunking: Fixed-size, 512 tokens, 20% overlap | |
| 8-4 | Knowledge Bases データ同期 | ナレッジソースアップロード後に Sync を実行 | Step 7 |
| 8-5 | Knowledge Bases 検索設定 | Top-K: 3, Score threshold: 0.7 | Step 7 |

---

## 9. 音声処理 — Amazon Transcribe

| # | 設定 | 詳細 | Step |
|---|------|------|------|
| 9-1 | （作成不要） | Transcribe はジョブベースの API。リソース事前作成は不要 | — |
| 9-2 | IAM 権限 | AgentCore IAM ロールに `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob` を付与 | Step 4 |
| 9-3 | S3 出力先 | `tictrack-media-{env}/transcriptions/` プレフィックス（自動作成） | Step 4 |

---

## 10. オーケストレーション — Step Functions + EventBridge

| # | リソース | 詳細 | Step |
|---|---------|------|------|
| 10-1 | Step Functions: **週次レポートワークフロー** | Map ステート (MaxConcurrency: 3)。子ども単位で並列レポート生成 | Step 6 |
|       | | ステップ: エピソード集計 → チェックイン取得 → 統計計算 → テキスト生成 (strands inline) → PDF → S3 → DDB | |
| 10-2 | Step Functions: **データ削除ワークフロー** | カスケード削除: User→Children→Episodes→Videos→AILabels→Reports→ShareTokens→Cognito | Step 8 |
| 10-3 | EventBridge Scheduler ルール | `tictrack-weekly-report` | Step 6 |
|       | | cron 式: `cron(0 0 ? * MON *)` (UTC 0:00 = JST 9:00) | |
|       | | ターゲット: Step Functions 週次レポートワークフロー | |

---

## 11. IAM ロール・ポリシー

| # | ロール | 信頼関係 | 必要な権限 | Step |
|---|-------|---------|-----------|------|
| 11-1 | **Amplify Service Role** | Amplify | CloudFormation, IAM, S3, Lambda, DynamoDB, Cognito, API Gateway | Step 0 |
| 11-2 | **Lambda Execution Role (API)** | Lambda | DynamoDB (CRUD 全テーブル), S3 (Presigned URL 生成), Step Functions (StartExecution), Cognito (AdminDeleteUser) | Step 1 |
| 11-3 | **Lambda Execution Role (AI Proxy)** | Lambda | AgentCore Invoke（HTTP 呼び出し）, DynamoDB (Episodes 更新) | Step 4 |
| 11-4 | **Lambda Execution Role (Report)** | Lambda | DynamoDB (Read 全テーブル), S3 (PUT reports/), Bedrock (Claude, Guardrails), CloudWatch Logs | Step 6 |
| 11-5 | **Lambda Execution Role (Deletion)** | Lambda | DynamoDB (Delete 全テーブル), S3 (Delete videos/, reports/), Cognito (AdminDeleteUser) | Step 8 |
| 11-6 | **AgentCore Runtime Role** | Bedrock AgentCore | Bedrock (Nova Pro, Claude Haiku, Guardrails, Knowledge Bases, Titan Embeddings), DynamoDB (AILabels, Episodes), S3 (Read media, Read knowledge), Transcribe (StartJob, GetJob) | Step 4 |
| 11-7 | **Step Functions Execution Role** | Step Functions | Lambda (Invoke), CloudWatch Logs | Step 6 |
| 11-8 | **EventBridge Scheduler Role** | EventBridge Scheduler | Step Functions (StartExecution) | Step 6 |
| 11-9 | **Knowledge Bases Service Role** | Bedrock | S3 (Read tictrack-knowledge-*), Bedrock (InvokeModel — Titan Embeddings) | Step 7 |

---

## 12. ローカル開発環境

| # | ツール / 設定 | 詳細 | Step |
|---|-------------|------|------|
| 12-1 | Node.js 20 | フロントエンド + Lambda (Node.js) | Step 0 |
| 12-2 | Python 3.12 | Strands Agents SDK | Step 0 |
| 12-3 | uv (Python パッケージマネージャ) | `pip install uv` | Step 0 |
| 12-4 | Docker Desktop | AgentCore コンテナビルド用。ARM64 ビルドサポート確認 | Step 0 |
| 12-5 | AWS CLI v2 | 各サービスの CLI 操作 | Step 0 |
| 12-6 | Amplify CLI | `npm install -g @aws-amplify/cli` | Step 0 |
| 12-7 | AgentCore CLI | `pip install bedrock-agentcore-cli` | Step 0 |
| 12-8 | Strands Agents SDK | `pip install strands-agents strands-agents-tools` | Step 0 |
| 12-9 | テストツール (Node.js) | Vitest, React Testing Library, Playwright | Step 0 |
| 12-10 | テストツール (Python) | pytest, moto (AWS モック), pytest-asyncio | Step 0 |

---

## 13. 監視・ログ（最低限）

| # | リソース | 詳細 | Step |
|---|---------|------|------|
| 13-1 | CloudWatch Logs | Lambda 自動出力。ログに PII を含めないこと | 自動 |
| 13-2 | API Gateway アクセスログ | 有効化（CloudWatch Logs 連携） | Step 1 |
| 13-3 | AgentCore ログ | AgentCore Observability — CloudWatch 連携 | Step 4 |

---

## Step 別チェックリスト（作成順）

### Step 0（Day 1-3）で作成

- [ ] 0-1〜0-6: アカウント・クレジット・モデルアクセス
- [ ] 1-1〜1-3: Amplify Gen 2 アプリ
- [ ] 5-1: ECR リポジトリ
- [ ] 6-1〜6-8: DynamoDB 8 テーブル + GSI
- [ ] 7-1〜7-2: S3 2 バケット + 設定
- [ ] 12-1〜12-10: ローカル開発環境

### Step 1（Day 4-5）で作成

- [ ] 2-1〜2-5: Cognito User Pool + Identity Pool
- [ ] 3-1〜3-4: API Gateway + Authorizer
- [ ] 4-1: api-handler Lambda
- [ ] 11-1〜11-2: IAM ロール (Amplify, Lambda API)

### Step 4（Day 10-13）で作成

- [ ] 4-2: ai-proxy Lambda
- [ ] 5-2〜5-7: Docker ビルド + AgentCore デプロイ + IAM
- [ ] 8-1〜8-2: Bedrock Guardrails
- [ ] 9-2〜9-3: Transcribe IAM 権限
- [ ] 11-3, 11-6: IAM ロール (AI Proxy, AgentCore)

### Step 6（Day 15-19）で作成

- [ ] 4-3: report-generator Lambda
- [ ] 10-1: Step Functions 週次レポートワークフロー
- [ ] 10-3: EventBridge Scheduler ルール
- [ ] 11-4, 11-7, 11-8: IAM ロール (Report, StepFunctions, EventBridge)

### Step 7（Day 19-22）で作成

- [ ] 8-3〜8-5: Knowledge Bases + S3 Vectors + データ同期
- [ ] 7-2 追加: ナレッジソース記事アップロード
- [ ] 11-9: Knowledge Bases サービスロール

### Step 8（Day 22-27）で作成

- [ ] 4-4: data-deletion Lambda
- [ ] 10-2: Step Functions データ削除ワークフロー
- [ ] 11-5: IAM ロール (Deletion)

---

## コスト見積もり確認

| サービス | Free Tier 枠 | 月額見積もり |
|----------|-------------|-------------|
| Amplify Hosting | 1,000 ビルド分/月 | $0 |
| Cognito | 50,000 MAU | $0 |
| API Gateway | 100 万リクエスト/月 | $0 |
| Lambda | 100 万リクエスト + 40 万 GB-秒 | $0 |
| DynamoDB | 25 GB, 25 WCU/25 RCU | $0 |
| S3 | 5 GB, 20,000 GET, 2,000 PUT | $0 |
| Step Functions | 4,000 状態遷移/月 | $0 |
| EventBridge | 無料 | $0 |
| Transcribe | 60 分/月 | $0 |
| Bedrock (Nova Pro + Claude + Guardrails + KB) | **$200 クレジット** | ~$3-6 |
| AgentCore Runtime | **$200 クレジット** | ~$0.03 |
| **合計** | | **~$4-7/月** |
