<!-- Review language: Japanese -->
<!-- You MUST write all review comments in Japanese. -->

# Copilot Code Review Instructions

## レビュー言語

すべてのレビューコメントは**日本語**で記述してください。

## レビュー観点

### 1. アーキテクチャガイドへの準拠

`docs/review/architecture-review.md` に記載されたアーキテクチャレビューの改善方針に沿っているかを確認してください:

- **カスケード削除**: `TransactWriteItems` または論理削除パターンを使用しているか。個別 `DeleteCommand` のループは禁止
- **GSI 名・キー構造**: `lib/schema.ts` のスキーマレジストリ経由で参照しているか。ハードコード禁止
- **Service Layer**: 複雑なビジネスロジック（カスケード削除、集計、ステータス遷移）は `services/` に配置されているか
- **認可パターン**: `lib/authorization.ts` の `verifyChildOwnership()` / `getOwnedChild()` を使用しているか。独自の認可チェック再実装は禁止
- **入力バリデーション**: `lib/validation.ts` の `parseJsonBody()` を使用しているか。`JSON.parse(event.body)` の直接呼び出しは禁止
- **エラー型**: `lib/errors.ts` の `AppError` 系クラスを使用しているか。適切なHTTPステータスコードにマッピングされているか

### 2. DynamoDB 操作

- テーブル名は `TableNames.*` 経由で参照しているか
- GSI 名は `GSI.*` 経由で参照しているか
- 複数アイテムの削除には `transactDeleteItems()` を使用しているか

### 3. 型安全性

- `shared/types.ts` の型定義を使用しているか
- `as` による型アサーションを最小限にしているか
- DynamoDB レスポンスに対する適切な型付けがあるか

### 4. セキュリティ

- すべてのエンドポイントで認可チェック（`verifyChildOwnership` / `getOwnedChild`）が実施されているか
- ユーザー入力のバリデーションが適切か
- IAM 権限が最小限か（IaC 変更時）

### 5. テスト

- 新機能にはテストが含まれているか
- テストが実際の動作を検証しているか（`expect(true).toBe(true)` のような無意味なアサーション禁止）
- エッジケース・エラーケースがカバーされているか

## レビューコメントのプレフィックス

以下のプレフィックスを使用してください:

- `[must]` — 必ず修正が必要
- `[imo]` — 意見・提案（修正必須ではない）
- `[nits]` — 些細な指摘
- `[ask]` — 質問・確認
- `[fyi]` — 参考情報
