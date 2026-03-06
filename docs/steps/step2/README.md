# Step 2: チックカード管理 + ワンタップ記録

> **日程**: Day 4-6
> **前提**: Step 1 完了（認証 + Children CRUD）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §4.2, §5.2, §6.2 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)

---

## 目標

チックカード作成 → ワンタップでエピソード記録 → タイムライン表示。

---

## 前提条件

- Step 1 の認証 + Children CRUD が完了
- Lambda api-handler のルーターが動作中

---

## 成果物

### バックエンド

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/routes/tic-cards.ts` | TicCards CRUD |
| `amplify/functions/api-handler/routes/episodes.ts` | Episodes 作成・一覧 |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/page.tsx` | ダッシュボード/タイムライン（エピソード日別一覧） |
| `src/app/tic-cards/page.tsx` | チックカード管理画面 |
| `src/components/tic-cards/` | チックカード関連コンポーネント |
| `src/components/episodes/` | エピソード関連コンポーネント |
| `src/components/timeline/` | タイムライン表示コンポーネント |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2

### TicCards CRUD

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/children/{childId}/tic-cards` | チックカード一覧 |
| POST | `/children/{childId}/tic-cards` | チックカード作成 |
| PUT | `/children/{childId}/tic-cards/{cardId}` | チックカード更新 |
| DELETE | `/children/{childId}/tic-cards/{cardId}` | チックカード削除 |

### Episodes

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/children/{childId}/episodes?from=&to=` | 期間指定でエピソード一覧 |
| POST | `/children/{childId}/episodes` | エピソード作成 |

### リクエスト/レスポンス例

**POST `/children/{childId}/tic-cards`**:
```json
{
  "label": "首振り",
  "type": "motor",
  "description": "左右に首を振る動作",
  "severity": 2
}
```

**POST `/children/{childId}/episodes`** (ワンタップ記録):
```json
{
  "recordType": "quick_log",
  "ticCardId": "01HXYZ...",
  "occurredAt": "2026-03-01T14:30:00Z",
  "context": "homework"
}
```

---

## データモデル

> 参照: `architecture_final.md` §6.2

### TicCards テーブル

| 属性 | 型 | 説明 |
|------|-----|------|
| PK: `cardId` | String (ULID) | チックカード ID |
| `childId` | String | 子ども ID |
| `label` | String | 表示名（例: 「首振り」） |
| `type` | String | `motor` / `vocal` |
| `description` | String | 詳細説明（任意） |
| `severity` | Number | デフォルト重さ (1-3) |
| `isActive` | Boolean | 有効/無効 |
| `createdAt` / `updatedAt` | String (ISO 8601) | タイムスタンプ |

- **GSI: `childId-index`** — PK: `childId`, SK: `createdAt`

### Episodes テーブル（一部フィールドは Step 3-4 で使用）

| 属性 | 型 | 説明 |
|------|-----|------|
| PK: `episodeId` | String (ULID) | エピソード ID |
| `childId` | String | 子ども ID |
| `recordType` | String | `video` / `quick_log` |
| `ticCardId` | String (optional) | チックカード ID |
| `occurredAt` | String (ISO 8601) | 発生日時 |
| `context` | String | 状況 |
| `notes` | String | メモ（任意） |
| `labelStatus` | String | `pending` / `confirmed` |
| `createdAt` / `updatedAt` | String (ISO 8601) | タイムスタンプ |

- **GSI: `childId-occurredAt-index`** — PK: `childId`, SK: `occurredAt`

---

## 作業内容

### 1. TicCards CRUD API

- `routes/tic-cards.ts` で CRUD 操作実装
- ULID でカード ID 生成
- バリデーション:
  - `label` 必須
  - `type` は `motor` / `vocal` のいずれか
  - `severity` は 1-3 の整数
- 子ども所有権チェック（Children テーブルの `userId` 確認）
- Cross-child isolation: 他の子どものカードにはアクセス不可

### 2. Episodes 作成 API

- `routes/episodes.ts` で作成・一覧取得実装
- ワンタップ記録: `recordType: "quick_log"` + `ticCardId` で即時記録
- `occurredAt` は ISO 8601 形式
- `labelStatus` はワンタップ記録の場合 `confirmed`（AI 分析不要）
- 日付範囲検索: GSI `childId-occurredAt-index` を使用、`from`/`to` パラメータ

### 3. フロントエンド

- **ダッシュボード (`/`)**: エピソードを `occurredAt` 降順で日別表示
- **チックカード管理 (`/tic-cards`)**: カード一覧 + 追加・編集・削除
- **ワンタップ記録**: チックカード選択 → 即時記録ボタン
- SWR でデータフェッチ + キャッシュ

---

## TDD テスト項目

- [ ] チックカード作成（POST）で `cardId`（ULID）, `label`, `type`（motor/vocal）, `severity`（1-3）が正しく保存されること
- [ ] チックカード一覧取得（GET）で指定した `childId` のカードのみが返ること
- [ ] チックカード更新（PUT）で `label` と `severity` が変更されること
- [ ] チックカード削除（DELETE）で該当レコードが消えること
- [ ] ワンタップ記録（POST `/episodes`、`recordType: "quick_log"`）でエピソードが作成され、`occurredAt` が ISO 8601 形式であること
- [ ] ワンタップ記録に `ticCardId` が正しく紐づくこと
- [ ] エピソード一覧取得で `from` / `to` パラメータによる日付範囲フィルタが正しく機能すること
- [ ] タイムラインがエピソードを `occurredAt` 降順で表示すること
- [ ] 子ども A のチックカードが子ども B のエピソードに紐づかないこと（cross-child isolation）
- [ ] `severity` が 0 以下または 4 以上の場合にバリデーションエラーが返されること
- [ ] `type` が `motor` / `vocal` 以外の場合にバリデーションエラーが返されること

---

## 完了基準

- チックカード「首振り」を作成 → ワンタップで発生記録 → タイムラインに「2/6 14:30 首振り」と表示される
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 3: 動画キャプチャ + アップロード](../step3/README.md)
