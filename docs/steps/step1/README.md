# Step 1: 認証 + ユーザー/子どもプロフィール

> **日程**: Day 2-4
> **前提**: Step 0 完了
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §4.2, §5.2, §6.2, §11.1 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)

---

## 目標

サインアップ → ログイン → 子ども登録の完全フロー実装。

---

## 前提条件

- Step 0 のスキャフォールドが完了
- Amplify Sandbox で Cognito User Pool + API Gateway + Lambda が作成済み

---

## 成果物

### バックエンド（Amplify — 既に作成済みの定義）

| リソース | ファイル | 備考 |
|---------|---------|------|
| Cognito User Pool | `amplify/auth/resource.ts` | email ログイン、パスワードポリシー |
| S3 media バケット | `amplify/storage/resource.ts` | videos/, tmp/, reports/ |
| Lambda api-handler | `amplify/functions/api-handler/` | 501 → 実装 |
| API Gateway REST | `amplify/custom/api/index.ts` | Cognito Authorizer |

### Lambda ハンドラ実装

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/handler.ts` | メインルーター |
| `amplify/functions/api-handler/routes/children.ts` | Children CRUD |
| `amplify/functions/api-handler/routes/users.ts` | Users プロフィール |
| `amplify/functions/api-handler/lib/auth.ts` | Cognito ユーザー ID 抽出 |
| `amplify/functions/api-handler/lib/dynamodb.ts` | DynamoDB ヘルパー |
| `amplify/functions/api-handler/lib/validation.ts` | バリデーションユーティリティ |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/auth/page.tsx` | ログイン/サインアップ画面 |
| `src/app/settings/page.tsx` | プロフィール設定 |
| `src/components/auth/` | 認証関連コンポーネント |
| `src/components/children/` | 子ども管理コンポーネント |
| `src/lib/api.ts` | API クライアント |
| `src/lib/auth.ts` | Amplify Auth ラッパー |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2

### Children CRUD

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/children` | ログインユーザーの子ども一覧取得 |
| POST | `/children` | 子ども追加 |
| PUT | `/children/{childId}` | 子ども情報更新 |
| DELETE | `/children/{childId}` | 子ども削除 |

### リクエスト/レスポンス

**POST `/children`**:
```json
{
  "displayName": "タロウ",
  "birthYearMonth": "2020-05"
}
```

**レスポンス**:
```json
{
  "childId": "01HXYZ...",
  "userId": "cognito-sub-xxx",
  "displayName": "タロウ",
  "birthYearMonth": "2020-05",
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:00:00Z"
}
```

---

## データモデル

> 参照: `architecture_final.md` §6.2

### Users テーブル

| 属性 | 型 | 説明 |
|------|-----|------|
| PK: `userId` | String | Cognito sub |
| `email` | String | メールアドレス |
| `displayName` | String | 表示名 |
| `settings` | Map | アプリ設定 |
| `createdAt` | String (ISO 8601) | 作成日時 |
| `updatedAt` | String (ISO 8601) | 更新日時 |

### Children テーブル

| 属性 | 型 | 説明 |
|------|-----|------|
| PK: `childId` | String (ULID) | 子ども ID |
| `userId` | String | 親ユーザー ID |
| `displayName` | String | 表示名 |
| `birthYearMonth` | String | 生年月（YYYY-MM） |
| `createdAt` | String (ISO 8601) | 作成日時 |
| `updatedAt` | String (ISO 8601) | 更新日時 |

- **GSI: `userId-index`** — PK: `userId`, SK: `createdAt`

---

## 作業内容

### 1. Cognito 認証フロー

- Amplify Auth（`defineAuth`）で email/password 認証は定義済み
- `backend.ts` で UserPool にパスワードポリシー + `coppa_consent` カスタム属性をオーバーライド済み
- Amplify UI Components の `Authenticator` コンポーネントでサインアップ/ログイン UI を構築
- COPPA 対応: サインアップ時に「18歳以上の保護者であること」＋「データ収集同意」チェックボックス

### 2. Lambda API ハンドラ実装

- `handler.ts` をルーターとして実装（パスベースのルーティング）
- リクエストから Cognito ユーザー ID を抽出（`event.requestContext.authorizer.claims.sub`）
- Children CRUD 操作を DynamoDB SDK で実装
- ULID でID生成（`ulid` パッケージ）
- バリデーション: `displayName` 必須、`birthYearMonth` は `YYYY-MM` フォーマット
- エラーハンドリング: RFC 7807 (Problem Details) 準拠

### 3. 認可チェック

- API Gateway Cognito Authorizer（`amplify/custom/api/index.ts` で設定済み）
- Lambda 内でユーザー所有権チェック（Children の `userId` がリクエストユーザーと一致）
- 不一致時は 403 Forbidden

### 4. フロントエンド UI

- `/auth` ページ: Amplify UI `Authenticator` コンポーネント
- `/settings` ページ: 子ども一覧 + 追加/編集/削除
- API クライアント: Cognito JWT を Authorization ヘッダーに付与

---

## TDD テスト項目

- [ ] メールアドレス + パスワードでサインアップが成功すること
- [ ] 登録済みユーザーでログインが成功し、JWT トークンが取得できること
- [ ] ログアウト後にトークンが無効化されること
- [ ] 子どもの作成（POST `/children`）で `childId`（ULID）が返されること
- [ ] 子どもの一覧取得（GET `/children`）でログインユーザーの子どものみが返ること
- [ ] 子どもの更新（PUT `/children/{childId}`）で `displayName` が変更されること
- [ ] 子どもの削除（DELETE `/children/{childId}`）で該当レコードが消えること
- [ ] 認証トークンなしの API リクエストが 401 Unauthorized を返すこと
- [ ] 他のユーザーの子どもへのアクセスが 403 Forbidden を返すこと
- [ ] `displayName` が空文字の場合にバリデーションエラー（400）が返されること
- [ ] `birthYearMonth` のフォーマットが `YYYY-MM` 以外の場合にバリデーションエラーが返されること

---

## 完了基準

- ユーザー登録 → ログイン → 子ども「タロウ」追加 → プロフィール確認 → ログアウト が動作する
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 2: チックカード管理 + ワンタップ記録](../step2/README.md)
