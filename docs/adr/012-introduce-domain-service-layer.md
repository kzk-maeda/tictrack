# ADR 012: ドメインサービス層の導入

## ステータス

承認済み（2026-03-12）

## 背景

ビジネスロジック（所有権チェック、カスケード削除、ステータス遷移）がルートハンドラに直書きされている状態：

### 現状の問題点
1. **責務の混在**: HTTPリクエスト処理とビジネスロジックが同じファイルに混在
2. **重複のリスク**: 新しいエントリポイント（Lambda関数等）を追加する際にロジックを再実装する必要
3. **テストの困難さ**: ルートハンドラ全体をモックしないとビジネスロジックのみをテストできない
4. **保守性の低下**: 複雑な処理（カスケード削除等）が148行のハンドラ内に埋め込まれている

### 例: `routes/children.ts` の `deleteChild` ハンドラ

- 148行のコード
- カスケード削除ロジック（TicCards → Episodes/AILabels → MedicationCards/Logs → LifeEvents → Child）
- DynamoDB操作が直接記述
- 他の Lambda から同じロジックを呼べない

### 選択肢

#### 選択肢 1: 現状維持（ルートハンドラに直書き）
- メリット: シンプル、変更不要
- デメリット: 再利用不可、テスト困難、保守性低い

#### 選択肢 2: 共通関数に抽出（lib/配下）
- メリット: 再利用可能
- デメリット: ドメインロジックとインフラロジックが混在、責務が不明確

#### 選択肢 3: ドメインサービス層を導入（services/配下）
- メリット: 責務明確、テスト容易、再利用可能、ドメインロジックの集約
- デメリット: レイヤーが増える、学習コスト

## 決定

**`services/` ディレクトリにドメインサービスクラスを導入する。**

理由：
1. **責務の分離**: HTTPレイヤー（ルートハンドラ）とビジネスロジック（サービス）を明確に分離
2. **再利用性**: 複数のエントリポイント（REST API, Step Functions Lambda, etc.）から同じロジックを呼べる
3. **テスト容易性**: サービス単体でビジネスロジックをテスト可能
4. **保守性**: ビジネスロジックの変更がサービス層のみに閉じる

## 結果

### ポジティブ
- ✅ ビジネスロジックが独立してテスト可能に（4つの専用テスト追加）
- ✅ ルートハンドラが簡潔に（148行 → 3行）
- ✅ カスケード削除ルールが単一ソースに集約
- ✅ 他のLambdaから同じロジックを呼び出せる

### ネガティブ
- ❌ レイヤーが1つ増える（学習コスト）
- ❌ 単純なCRUDでもサービス層を経由する必要がある可能性

### トレードオフ
- **シンプルさ** vs **保守性/再利用性** → プロトタイプから本番移行を見据えて保守性を優先
- **全てサービス化** vs **複雑な処理のみ** → 段階的導入（カスケード削除等の複雑な処理から）

## 実装パターン

### ディレクトリ構造

```
amplify/functions/api-handler/
├── routes/                 # HTTPリクエスト処理
│   └── children.ts
├── services/               # ビジネスロジック
│   ├── __tests__/
│   │   └── child-service.test.ts
│   └── child-service.ts
└── lib/                    # 共通ユーティリティ
    ├── authorization.ts
    └── dynamodb.ts
```

### サービスクラスの設計原則

1. **静的メソッド**: 状態を持たないユーティリティクラスとして実装
2. **認可の委譲**: `lib/authorization.ts` の共通関数を使用
3. **エラー処理**: ビジネス例外（ForbiddenError, NotFoundError）をスロー
4. **純粋なビジネスロジック**: HTTPやAPIゲートウェイの知識を持たない

### サービス実装例

```typescript
// services/child-service.ts
export class ChildService {
  static async deleteChildCascade(childId: string, userId: string): Promise<void> {
    // 1. 認可チェック
    await getOwnedChild(childId, userId);

    // 2. カスケード削除（ビジネスルール）
    // TicCards → Episodes/AILabels → MedicationCards/Logs → LifeEvents → Child
    // ...実装省略...
  }
}
```

### ルートハンドラでの使用例

```typescript
// routes/children.ts
export async function deleteChild(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await ChildService.deleteChildCascade(childId, userId);

  return noContent();
}
```

### テストパターン

**サービス層のテスト（単体テスト）:**
- DynamoDB, Authorization をモック
- ビジネスロジックのみを検証
- 認可失敗、データなし等のエッジケース

**ルートハンドラのテスト（統合テスト）:**
- サービス層は実装のまま使用（モック不要）
- HTTPリクエスト/レスポンスの整合性を検証
- 既存テストがそのまま動作することを確認（リファクタリングのセーフティネット）

## 段階的導入計画

### Phase 1（完了）: 最も複雑な処理から
- ✅ `ChildService.deleteChildCascade()` - カスケード削除

### Phase 2（今後）: 他の複雑な処理
- `EpisodeService.startAnalysis()` - AI分析開始ロジック（start-analysis Lambdaから呼べるように）
- `ReportService.generateWeeklyReport()` - 週次レポート生成ロジック

### Phase 3（必要に応じて）: 単純なCRUDの抽出
- 必要性が出てきたら検討（現時点では過度な抽象化を避ける）

## 設計ルール

### ✅ DO
1. **複雑なビジネスロジックはサービス層に抽出する**
   - カスケード削除、ステータス遷移、集計処理等
2. **サービスは静的メソッドで実装する**
   - 状態を持たないユーティリティクラス
3. **認可は共通モジュール（lib/authorization.ts）を使用する**
   - サービス層で認可ロジックを再実装しない
4. **TDDでサービスを作成する**
   - テストを先に書き、ビジネスルールを明確化
5. **ルートハンドラはHTTP処理に集中する**
   - リクエスト解析、レスポンス構築、サービス呼び出しのみ

### ❌ DON'T
1. **単純なCRUDを無理にサービス化しない**
   - 過度な抽象化を避ける
2. **サービス層にHTTP知識を持たせない**
   - `APIGatewayProxyEvent` を渡さない
3. **サービス層でレスポンスを構築しない**
   - `ok()`, `created()` 等はルートハンドラの責務
4. **サービス間で直接呼び合わない**
   - 循環依存を避ける（必要なら共通ユーティリティに抽出）

## 関連 ADR

なし

## 参考資料

- [Domain-Driven Design: Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)
- [Clean Architecture: Use Cases](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
