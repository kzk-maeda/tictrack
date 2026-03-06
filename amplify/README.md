# Amplify バックエンド実行ガイド

## 前提条件

- Node.js 20+
- AWS CLI v2
- AWS アカウント（Amplify Gen 2 対応）

## セットアップ

```bash
# プロジェクトルートで実行
npm install
```

> **Note**: `npx create-amplify` は既に `amplify/` ディレクトリが存在すると実行できない。
> 依存パッケージは `package.json` に定義済みのため `npm install` のみで準備完了。

---

## AWS 認証情報

Amplify sandbox / デプロイは内部で AWS CDK を使用するため、有効な AWS 認証情報が必要。
以下のいずれかの方法で渡す。

### 方法 1: AWS プロファイル（推奨）

```bash
# ~/.aws/credentials にプロファイルを設定済みの場合
export AWS_PROFILE=tictrack-dev
npx ampx sandbox
```

```ini
# ~/.aws/credentials
[tictrack-dev]
aws_access_key_id = AKIA...
aws_secret_access_key = xxxx
region = us-east-1
```

### 方法 2: 環境変数

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=xxxx
export AWS_REGION=us-east-1
npx ampx sandbox
```

### 方法 3: IAM Identity Center（SSO）

```bash
aws sso login --profile tictrack-dev
export AWS_PROFILE=tictrack-dev
npx ampx sandbox
```

### 方法 4: AWS IAM ロール（CI/CD 用）

GitHub Actions 等では OIDC によるロール引き受けを使用する。
Amplify Hosting の場合はサービスロールが自動的に使用される。

### 必要な IAM 権限

sandbox 実行ユーザー / ロールには **AdministratorAccess-Amplify** マネージドポリシー、
または以下のサービスへのフルアクセスが必要:

- CloudFormation
- IAM (ロール・ポリシーの作成)
- Cognito
- S3
- Lambda
- API Gateway
- DynamoDB
- ECR
- SSM (Parameter Store)
- CloudWatch Logs

### CDK ブートストラップ（初回のみ・必須）

Amplify は内部で CDK を使用する。対象アカウント・リージョンで **CDK ブートストラップが未実行の場合、sandbox 起動時に `InvalidOrCannotAssumeRoleError` が発生する**。

初回は必ず以下を実行すること:

```bash
# アカウント ID とリージョンを指定
npx cdk bootstrap aws://728291782722/ap-northeast-1

# または現在の認証情報から自動取得
npx cdk bootstrap
```

> ブートストラップはアカウント × リージョンごとに 1 回のみ必要。
> CDK が使用する IAM ロール・S3 バケット等が CloudFormation スタック `CDKToolkit` として作成される。

---

## ローカル開発（Sandbox）

sandbox は開発者ごとに独立した AWS 環境を作成する。
リソース名にはブランチ名 + ユーザー識別子が自動付与され、他の開発者と衝突しない。

```bash
# sandbox 起動（ファイル変更を監視し自動デプロイ）
npx ampx sandbox

# プロファイル指定
npx ampx sandbox --profile tictrack-dev

# sandbox 状態確認
npx ampx sandbox status

# Amplify 設定ファイル生成（フロントエンド連携用）
npx ampx generate outputs --out-dir ./src

# CloudFormation 出力値をファイルに書き出し
npx ampx sandbox --outputs-out-dir ./

# sandbox 削除（作業終了時）
npx ampx sandbox delete
```

### sandbox が作成するリソース（Step 0-1）

| カテゴリ | リソース |
|---------|---------|
| Auth | Cognito User Pool + Client + Identity Pool |
| Storage | S3 media バケット（lifecycle: videos/→GLACIER_IR@90d, tmp/→delete@1d） |
| Function | Lambda api-handler（Node.js 20, ARM64, 256MB） |
| Database | DynamoDB 8 テーブル（Users, Children, TicCards, Episodes, AILabels, CheckIns, WeeklyReports, ShareTokens） |
| Foundation | S3 knowledge バケット + ECR リポジトリ |
| API | API Gateway REST + Cognito Authorizer |

---

## 環境別デプロイ

### 環境の種類

| 環境 | 用途 | デプロイ方法 |
|------|------|-------------|
| sandbox | 個人開発 | `npx ampx sandbox` (ローカル CLI) |
| dev | 統合テスト | Amplify Hosting (main ブランチ) |
| prod | 本番 | Amplify Hosting (production ブランチ) |

### Amplify Hosting によるブランチデプロイ

Amplify Gen 2 は Git ブランチとバックエンド環境を 1:1 で紐付ける。
Amplify Hosting を設定すると、ブランチへの push で自動デプロイが実行される。

```bash
# 1. Amplify コンソールで GitHub リポジトリを接続
#    https://console.aws.amazon.com/amplify/

# 2. ブランチごとの環境が自動作成される
#    main       → dev 環境（バックエンド + フロントエンド）
#    production → prod 環境
```

ブランチ環境ごとに独立した CloudFormation スタックが作成される:
- `amplify-<app-id>-main-branch-*` (dev)
- `amplify-<app-id>-production-branch-*` (prod)

### 手動デプロイ（Amplify Hosting 未使用の場合）

```bash
# 特定ブランチとしてデプロイ
npx ampx pipeline-deploy --branch main --app-id <AMPLIFY_APP_ID>
```

### 環境変数の分離

環境ごとに異なる値が必要な場合は Amplify のブランチ環境変数を使用する:

```bash
# Amplify コンソール > アプリ設定 > 環境変数 で設定
# または aws cli で設定
aws amplify update-branch \
  --app-id <APP_ID> \
  --branch-name main \
  --environment-variables CORS_ORIGIN=https://main.d123.amplifyapp.com
```

`backend.ts` で参照する場合:

```typescript
// backend.ts 内で環境変数を参照
const corsOrigin = process.env.CORS_ORIGIN ?? "*";
```

### シークレット管理

API キーなどの機密値は Amplify のシークレット機能を使用する:

```bash
# シークレット設定（全ブランチ共通）
npx ampx sandbox secret set MY_SECRET

# ブランチ固有のシークレット
npx ampx sandbox secret set MY_SECRET --branch main
```

---

## 段階的リソース追加

`backend.ts` はロードマップのステップに合わせて段階的にリソースを有効化する設計。

| Step | 内容 | 操作 |
|------|------|------|
| 0-1 | Auth + DB + API | **現在有効** |
| 4 | AI ラベリング | `functions/ai-proxy/` 作成、`custom/ai/` 作成、backend.ts のコメント解除 |
| 6 | 週次レポート | `functions/report-generator/` 作成、`custom/orchestration/` 作成 |
| 7 | マイクロガイド KB | `CREATE_KNOWLEDGE_BASE=true` で AiConstruct 内有効化 |
| 8 | データ削除 | `functions/data-deletion/` 作成、OrchestrationConstruct に追加 |

各ステップで sandbox を再起動すると差分リソースが追加される。

---

## ディレクトリ構成

```
amplify/
├── backend.ts                      # バックエンド定義（段階的有効化）
├── auth/resource.ts                # Cognito 設定
├── storage/resource.ts             # S3 media バケット
├── functions/
│   └── api-handler/
│       ├── resource.ts             # Lambda 定義
│       └── handler.ts              # ハンドラ（現在 501 プレースホルダー）
└── custom/
    ├── database/index.ts           # DynamoDB 8 テーブル（CDK Construct）
    ├── foundation/index.ts         # S3 knowledge + ECR（CDK Construct）
    └── api/index.ts                # API Gateway REST（CDK Construct）
```

---

## トラブルシューティング

### sandbox 起動に失敗する

```bash
# AWS 認証情報を確認
aws sts get-caller-identity

# プロファイル指定で再試行
npx ampx sandbox --profile tictrack-dev

# CDK ブートストラップ実行（初回のみ）
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

### リソースが残ってしまった

```bash
# sandbox を明示的に削除
npx ampx sandbox delete

# それでも残る場合は CloudFormation コンソールから手動削除
# スタック名: amplify-<app-id>-<user>-sandbox-*
```

### デプロイ時に IAM 権限エラー

sandbox 実行ユーザーに **AdministratorAccess-Amplify** ポリシーがアタッチされているか確認:

```bash
aws iam list-attached-user-policies --user-name <USERNAME>
```
