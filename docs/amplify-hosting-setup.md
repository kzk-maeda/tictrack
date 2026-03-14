# Amplify Hosting セットアップ手順

TicTrack を Amplify Hosting で CI/CD デプロイする手順。
`main` → Production、`develop` → Staging の2環境構成。

---

## 前提

- AWS アカウント: `ap-northeast-1` で CDK bootstrap 済み
- GitHub リポジトリ: `kzk-maeda/tictrack`
- 現在の sandbox 環境が動作中

---

## Phase 1: リポジトリ準備（ローカル作業）

### 1-1. `amplify.yml` を作成

プロジェクトルートに作成済み（このPRに含まれる）。
Amplify Hosting のビルドスペックとして使用される。

### 1-2. `.amplifyignore` を作成

デプロイ不要なファイルを除外（このPRに含まれる）。

### 1-3. `develop` ブランチを作成

```bash
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop
```

---

## Phase 2: Amplify Hosting 接続（AWS コンソール作業）

### 2-1. Amplify アプリ作成

1. [Amplify コンソール](https://ap-northeast-1.console.aws.amazon.com/amplify/home?region=ap-northeast-1) を開く
2. **Create new app** をクリック
3. **GitHub** を選択 → OAuth 認証
4. リポジトリ `kzk-maeda/tictrack` を選択

### 2-2. Production ブランチ設定

1. ブランチ: **main** を選択
2. App name: `tictrack`
3. Environment: `production`
4. Build settings: **amplify.yml を自動検出** (Use the amplify.yml in the repository)
5. Service role: Amplify に必要な IAM ロールを作成（自動 or 手動）
   - 手動の場合: `AmplifyConsoleServiceRole-AmplifyRole` を作成し、以下のポリシーをアタッチ:
     - `AdministratorAccess-Amplify`
6. **Save and deploy** をクリック

### 2-3. Staging ブランチ追加

1. Amplify コンソール → 作成したアプリ → **Hosting** → **Branch deployments**
2. **Add branch** をクリック
3. ブランチ: **develop** を選択
4. Environment: `staging`
5. **Save and deploy**

### 2-4. 環境変数設定

Amplify コンソール → **Hosting** → **Environment variables** で以下を設定:

| 変数名 | Production (main) | Staging (develop) | 説明 |
|--------|-------------------|-------------------|------|
| `NEXT_PUBLIC_APP_ENV` | `production` | `staging` | アプリ環境識別 |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | `--max-old-space-size=4096` | Next.js ビルドメモリ |

> **Note**: `amplify_outputs.json` はビルド時に `npx ampx generate outputs` で自動生成されるため、
> API エンドポイントや Cognito の設定はブランチごとに自動で分離される。

### 2-5. PR プレビュー設定（任意）

1. Amplify コンソール → **Hosting** → **Previews**
2. **Enable previews** をクリック
3. GitHub App をインストール（Amplify が案内する手順に従う）
4. PR ごとに一時環境が自動作成される

---

## Phase 3: 動作確認

### 3-1. Production デプロイ確認

```bash
# main にマージされると自動デプロイが開始
# Amplify コンソールでビルドログを確認
```

確認ポイント:
- [ ] ビルドが成功する
- [ ] `https://main.d{app-id}.amplifyapp.com` でアプリにアクセスできる
- [ ] 認証（サインアップ/ログイン）が動作する
- [ ] API 呼び出しが正常に動作する

### 3-2. Staging デプロイ確認

```bash
# develop にプッシュすると自動デプロイ
git checkout develop
git merge main
git push origin develop
```

確認ポイント:
- [ ] `https://develop.d{app-id}.amplifyapp.com` でアクセスできる
- [ ] Production とは別の Cognito User Pool / DynamoDB テーブルが作成されている

---

## Phase 4: カスタムドメイン設定（任意）

### 4-1. ドメイン追加

1. Amplify コンソール → **Hosting** → **Custom domains**
2. **Add domain** をクリック
3. ドメイン名を入力（例: `tictrack.app`）
4. サブドメインマッピング:
   - `tictrack.app` → `main`（Production）
   - `staging.tictrack.app` → `develop`（Staging）
5. DNS 設定: Amplify が表示する CNAME レコードを DNS プロバイダに追加
6. SSL 証明書: Amplify が ACM で自動発行・自動更新

---

## ブランチ運用ルール

```
main (Production)
  ↑ PR マージ
develop (Staging)
  ↑ PR マージ
feature/* (開発)
```

1. `feature/*` ブランチで開発
2. `develop` への PR → CI チェック → マージ → Staging 自動デプロイ
3. Staging で動作確認
4. `develop` → `main` への PR → マージ → Production 自動デプロイ

---

## 環境分離の仕組み

Amplify Gen 2 はブランチごとに独立した AWS リソースを自動作成する:

| リソース | Production (main) | Staging (develop) |
|---------|-------------------|-------------------|
| Cognito User Pool | 自動で別インスタンス | 自動で別インスタンス |
| DynamoDB テーブル | 自動で別テーブル | 自動で別テーブル |
| S3 バケット | 自動で別バケット | 自動で別バケット |
| API Gateway | 自動で別エンドポイント | 自動で別エンドポイント |
| Lambda 関数 | 自動で別関数 | 自動で別関数 |
| Step Functions | 自動で別ステートマシン | 自動で別ステートマシン |

> Amplify Gen 2 がブランチ名 + アプリID をリソース名に含めることで自動分離される。
> `amplify_outputs.json` もブランチごとに生成されるため、フロントエンドは自動的に正しい環境に接続する。

---

## トラブルシューティング

### ビルドが失敗する場合

1. Amplify コンソールのビルドログを確認
2. `amplify.yml` の `preBuild` / `build` コマンドをローカルで再現
3. Node.js バージョンが 20 であることを確認（`amplify.yml` で指定済み）

### バックエンドデプロイが失敗する場合

1. CloudFormation スタックのイベントを確認
2. サービスロールの権限不足: `AdministratorAccess-Amplify` がアタッチされているか確認
3. CDK bootstrap が実行済みか確認: `npx cdk bootstrap aws://<ACCOUNT_ID>/ap-northeast-1`

### sandbox との共存

- Amplify Hosting のデプロイと `npx ampx sandbox` は独立して動作する
- sandbox はローカル開発用、Hosting は CI/CD 用
- 同時に使用しても問題なし（リソース名が異なる）
