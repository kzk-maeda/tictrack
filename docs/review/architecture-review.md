# TicTrack アーキテクチャレビュー

**日付**: 2026-03-15
**対象**: リポジトリ全体（FE / BE / Data Model / IaC / AI Agent）
**目的**: 今後の機能追加・開発体制拡大に対して安全に継続開発できる構造かを評価

---

## 1. 全体評価

プロトタイプとしての完成度は高く、単独開発者が 29 日間で構築した規模として妥当な設計判断が多い。特に **型定義の一元管理（`shared/types.ts`）**、**CDK Construct の分離**、**SWR による FE データフェッチの統一** は良い設計基盤になっている。

一方で、**BE の Route ハンドラに DynamoDB SDK 呼び出し・GSI 名・クエリ式がハードコードされている**点が最大の構造的リスク。現状は動作するが、テーブル設計変更・DB 移行・開発者追加時に影響範囲が爆発する。また、**カスケード削除のトランザクション不在**により、障害時にデータ不整合が発生しうる。

**スコアカード:**

| 観点 | 評価 | 備考 |
|------|------|------|
| 規模に対する構造の妥当性 | ⭐⭐⭐⭐ | 単独開発プロトタイプとして適切 |
| 変更影響の局所化 | ⭐⭐ | DB 関連の変更が 10+ ファイルに波及 |
| 責務分離 | ⭐⭐⭐ | FE↔BE は良好、BE↔Data は未分離 |
| ドメイン境界の整理 | ⭐⭐⭐ | 型は整理済、アクセスパターンが散在 |
| 壊れやすさ | ⭐⭐ | カスケード削除・GSI ハードコードがリスク |
| セキュリティ・運用 | ⭐⭐⭐⭐ | IAM 最小権限、認可チェック一貫 |

---

## 2. 良い点

### 2.1 型定義の Single Source of Truth
- `shared/types.ts` に全ドメインエンティティ（Child, Episode, TicCard 等）を定義
- FE（`src/lib/types.ts`）と BE（`amplify/functions/api-handler/types.ts`）が re-export で参照
- FE 固有型（ProblemDetails, DashboardData）は FE 側で追加定義
- **評価**: 型の不整合リスクを構造的に排除しており、規模拡大に耐える

### 2.2 SWR によるデータフェッチの統一
- 全フック（`use-children`, `use-episodes`, `use-tic-cards` 等）が同一パターンで実装
- `apiClient` が認証/デモモードを透過的に切り替え
- Optimistic Update を全 CRUD フックで実装
- **評価**: 新しいデータフェッチ追加時のパターンが明確で、開発者がブレにくい

### 2.3 CDK Construct の責務分離
- `DatabaseConstruct`, `ApiConstruct`, `AgentCoreConstruct`, `OrchestrationConstruct`, `FoundationConstruct` が独立
- `amplify/config/` で各 Construct の結合（env var 注入、IAM グラント）を集約
- Staged activation パターンで段階的にリソースを有効化
- **評価**: IaC レイヤーの変更影響は適切に局所化されている

### 2.4 IAM 最小権限の実践
- 各 Lambda に必要最小限のアクションとリソース ARN をスコープ
- API Handler: 12 テーブルへの CRUD + S3 ReadWrite
- AgentCore Proxy: Episodes/AILabels のみ + Bedrock InvokeAgentRuntime
- Start Analysis: Episodes Read/Write + Children Read + StepFunctions StartExecution
- **評価**: Lambda ごとに権限が絞られており、侵害時の爆発半径を制限

### 2.5 認可チェックの一貫性
- `lib/authorization.ts` に `verifyChildOwnership()` / `getOwnedChild()` を集約
- 全ルートで childId に対するオーナーシップ検証が実施されている
- **評価**: 認可バイパスの穴がない（ただし後述の一貫性の問題あり）

### 2.6 エラーハンドリングの 3 層設計
- BE: `AppError` 系クラス → `handler.ts` で catch → RFC 7807 ProblemDetails 応答
- FE API Client: ProblemDetails をパース → `ApiError` に変換
- FE Component: SWR error → toast / inline エラー表示
- **評価**: エラーの表現形式が各レイヤーで適切に変換されている

---

## 3. リスク/懸念点

### 3.1 [Critical] カスケード削除にトランザクションがない

**箇所**: `child-service.ts:25-166`, `episodes.ts:154-171`, `medications.ts:196-214`

子ども削除時に 7 テーブルを順次削除するが、途中で失敗した場合のロールバック機構がない。

```
Child 削除フロー:
  TicCards 削除 → Episodes 削除 → AILabels 削除 → MedicationCards 削除
  → MedicationLogs 削除 → LifeEvents 削除 → Child 削除
```

**障害シナリオ**: MedicationLogs 削除時にタイムアウト
- **結果**: TicCards, Episodes, AILabels, MedicationCards は削除済み、MedicationLogs/LifeEvents/Child は残存
- **検知手段**: なし（ログ上はエラーだが、不整合を検知する仕組みがない）
- **復旧**: 手動 DynamoDB 操作が必要

Episode/Medication の 2 レベルカスケード削除も同様。AILabel を削除した後に Episode 削除が失敗すると、ラベルだけが孤児化する。

### 3.2 [Critical] Route ハンドラが DynamoDB SDK に直接依存

**箇所**: `routes/*.ts` 全ファイル（10 ファイル）

Route ハンドラが `GetCommand`, `PutCommand`, `QueryCommand` 等を直接 import し、GSI 名・KeyConditionExpression・UpdateExpression をハードコードしている。

**影響範囲の例**: GSI 名 `childId-createdAt-index` を変更する場合
- `tic-cards.ts`, `medications.ts`, `child-service.ts` の最低 3 ファイルを修正
- テストファイルのモックも修正
- 見落とし時のエラーは実行時にしか発見できない

**ハードコード箇所の集計**:
- GSI 名参照: 18+ 箇所
- KeyConditionExpression 手書き: 15+ 箇所
- UpdateExpression 動的構築の重複: 4 箇所（children, tic-cards, medications, life-events で同一パターン）

### 3.3 [High] Service Layer がほぼ未実装

**箇所**: `services/` ディレクトリに `child-service.ts` のみ

ADR 012 で Service Layer 導入を決定しているが、実際に Service 化されたのは `ChildService.deleteChildCascade()` のみ。残り 9 ルートのビジネスロジック（カスケード削除、AI ラベル正規化、ダッシュボード集計等）は Route ハンドラに直接記述されている。

**リスク**: 開発者追加時、Route ハンドラに書くべきか Service に書くべきかの判断基準がコード上に示されておらず、ADR を読まないと分からない。結果として Route ハンドラが肥大化し続ける。

### 3.4 [Medium] FE が一部 BE 内部表現に結合

**箇所**: `src/components/timeline/timeline-day-group.tsx:88-117`

```typescript
// originalAILabel が string か object かで分岐
const labelData = typeof episode.originalAILabel === 'string'
  ? JSON.parse(episode.originalAILabel)
  : episode.originalAILabel;
```

FE が BE のストレージ形式（DynamoDB の Marshall 結果が string/object どちらかになりうる）を意識している。BE が保存形式を変更すると FE が壊れる。

**他の結合箇所**:
- `ai-label-section.tsx:108`: `episode.videoS3Key` を直接参照（S3 キー構造を FE が知っている）
- `ai-label-section.tsx:238`: `episode.labelStatus === "analyzing"` 等の文字列リテラル比較（Enum 化されていない）
- `dashboard-charts.tsx:40-42`: `data.typeDistribution.motor` 等の構造に直結合

### 3.5 [Medium] 認可パターンの不統一

**箇所**: `lib/authorization.ts`, `routes/videos.ts:28-70`

`verifyChildOwnership()` と `getOwnedChild()` の 2 関数が混在し、使い分けが不明確:
- `children.ts`: `getOwnedChild()` を使用（戻り値が必要）
- `tic-cards.ts`: `verifyChildOwnership()` を使用（戻り値不要）
- `videos.ts`: **独自の `verifyOwnership()` を再実装**（authorization.ts を使っていない）

`episodes.ts` では `verifyChildOwnership()` の後に**再度インラインで** `if (item.childId !== childId)` チェックを行っている箇所が 3 つある（lines 147-151, 214-216, 259-261）。

### 3.6 [Medium] 入力バリデーションの不統一

**箇所**: `routes/life-events.ts:61,126`, `routes/episodes.ts:89`

- `life-events.ts` は `parseJsonBody()` を使わず `JSON.parse(event.body || "{}")` を直接呼び出し
- `episodes.ts:89` で `recordType` バリデーション失敗時に `ValidationError` ではなく `ForbiddenError` を throw
- `tic-cards.ts:71-74` で条件分岐後にバリデーション（空文字列が検証をスキップ）
- Enum バリデーション（recordType, feedbackType, eventType）が集約されておらず各ルートで手書き

### 3.7 [Low] SWR キーレジストリの不在

**箇所**: `src/hooks/*.ts`

SWR キーが各フックにハードコードされており、一覧性がない:
```
"/children"
"/children/${childId}/tic-cards"
"/children/${childId}/episodes?from=${from}&to=${to}"
"/children/${childId}/dashboard?start=${startDate}&end=${endDate}"
"/children/${childId}/medications"
"/children/${childId}/life-events"
```

キー文字列が一致しないと SWR のキャッシュ共有やリバリデーションが機能しない。現在は問題ないが、同一データを複数コンポーネントから参照する機能追加時にバグの温床になる。

### 3.8 [Low] users.ts が PutCommand でユーザー更新

**箇所**: `routes/users.ts:76-80`

`UpdateCommand` ではなく `PutCommand` を使用しているため、リクエストに含まれないフィールド（email, createdAt 等）が上書きで消失するリスクがある。

---

## 4. 境界レビュー

### 4.1 FE ↔ BE

| 観点 | 評価 | 詳細 |
|------|------|------|
| API 契約 | ⭐⭐⭐ | REST + ProblemDetails で標準的。ただし OpenAPI 定義なし |
| 型共有 | ⭐⭐⭐⭐⭐ | `shared/types.ts` で一元管理。re-export パターン |
| 認証境界 | ⭐⭐⭐⭐ | FE は Cognito トークン取得のみ、BE が Authorizer で検証 |
| エラー形式 | ⭐⭐⭐⭐ | RFC 7807 ProblemDetails が統一的に使用 |
| 内部表現の漏洩 | ⭐⭐ | `originalAILabel` の string/object 判定、`videoS3Key` の直接参照、`labelStatus` の文字列比較 |

**境界が破れるシナリオ**:
- BE が `Episode.originalAILabel` の保存形式を変更 → FE の `timeline-day-group.tsx` が壊れる
- BE が `labelStatus` の値を追加/変更 → FE の条件分岐が不完全になる（silent failure）
- BE がダッシュボード応答のフィールドを追加/削除 → FE のチャートレンダリングが壊れる

**改善の方向**: BE 側で API レスポンスの正規化レイヤーを設け、内部表現（DynamoDB 形式）を FE に露出しない。`labelStatus` 等の Enum を `shared/types.ts` に定義し FE/BE で共有する。

### 4.2 BE ↔ Data Model

| 観点 | 評価 | 詳細 |
|------|------|------|
| アクセスパターンの集約 | ⭐ | GSI 名・キー構造が Route ハンドラに散在 |
| Repository / DAL | ⭐ | 不在。Route が DynamoDB SDK を直接呼び出し |
| スキーマ定義 | ⭐⭐ | CDK で定義されているが、アプリコードと連動していない |
| 型安全性 | ⭐⭐ | `shared/types.ts` で型定義はあるが、DynamoDB 応答の型検証なし |

**現在のデータアクセスパス**:
```
Route Handler
  → import { docClient, TableNames } from "../lib/dynamodb"
  → new QueryCommand({ TableName: TableNames.EPISODES, IndexName: "childId-occurredAt-index", ... })
  → docClient.send(command)
  → as Episode  // 型アサーションのみ、ランタイム検証なし
```

**境界が破れるシナリオ**:
- GSI 名を CDK で変更 → アプリコード 5+ 箇所を手動修正（見落としは実行時エラー）
- テーブルのキー構造を変更 → KeyConditionExpression 10+ 箇所を手動修正
- DynamoDB を別 DB に移行 → Route ハンドラ全ファイル + Service + authorization.ts + aggregation.ts を書き換え

**改善の方向**: Repository パターンの導入。各エンティティの CRUD + クエリを Repository クラスに集約し、Route からは `EpisodeRepository.findByChildId(childId, dateRange)` のように呼び出す。GSI 名・キー構造は Repository 内部に閉じ込める。

### 4.3 App ↔ Infra

| 観点 | 評価 | 詳細 |
|------|------|------|
| テーブル名の管理 | ⭐⭐⭐⭐ | env var 経由で注入、`TableNames` で一元管理 |
| IAM 権限のスコープ | ⭐⭐⭐⭐ | Lambda ごとに最小権限 |
| 構成管理の分離 | ⭐⭐⭐⭐ | `amplify/config/` で結合ロジックを集約 |
| 環境依存 | ⭐⭐⭐ | CORS `"*"` はプロトタイプ用。本番ではドメイン制限が必要 |
| Agent デプロイ | ⭐⭐⭐ | PUBLIC ネットワーク。本番では VPC 必要 |

**境界が破れるシナリオ**:
- CDK でテーブル追加時、`config/database.ts` の env var 注入を忘れる → Lambda 実行時エラー
- AgentCore のコンテナイメージを更新時、`latest` タグに依存しているため意図しないバージョンがデプロイされる可能性

**評価**: IaC レイヤーは最も整理されている部分。テーブル名の env var 注入パターンと Construct 分離は、このプロジェクト規模では十分。

### 4.4 Shared/Common ↔ Domain

| 観点 | 評価 | 詳細 |
|------|------|------|
| 共通ユーティリティ | ⭐⭐⭐⭐ | `lib/` に auth, validation, errors, response を集約 |
| ドメイン境界 | ⭐⭐ | 「子ども管理」「チックカード」「エピソード」「服薬」が Route レベルでは分離されているが、DB アクセスパターンは未分離 |
| 横断的関心事 | ⭐⭐⭐ | 認可は `authorization.ts` に集約（ただし videos.ts で再実装） |
| マスターデータ | ⭐⭐⭐ | `src/data/tic-symptoms.json` に症状定義を集約。`shared/types.ts` で構造を定義 |

**境界が破れるシナリオ**:
- `lib/aggregation.ts`（ダッシュボード集計）が 245 行あり、テーブル構造・GSI 名に依存。DynamoDB の項目構造変更時に影響
- `lib/authorization.ts` が DynamoDB SDK を直接使用。DB 変更時に認可ロジックも修正が必要

---

## 5. 優先度付き改善提案

### P0（構造的リスク — 機能追加前に対処すべき）

#### P0-1: カスケード削除の安全性確保

**問題**: 途中失敗時にデータ不整合が発生し、検知・復旧手段がない

**対策案**:
- **A) DynamoDB TransactWriteItems を使用**: 25 アイテム制限があるため、小規模なカスケード（Episode→AILabels）には適用可能
- **B) 論理削除 + 非同期物理削除**: `deletedAt` フラグを設定し、Step Functions で非同期バッチ削除。失敗時はリトライ可能
- **C) 削除前にマニフェスト記録**: 削除対象一覧を記録してから実行。失敗時はマニフェストから再実行

**推奨**: 小規模カスケード（Episode, Medication）は TransactWriteItems、Child 削除は論理削除パターンを推奨

#### P0-2: GSI 名・キー構造の一元管理

**問題**: 18+ 箇所にハードコードされた GSI 名が、スキーマ変更時の爆発半径を拡大

**対策**: スキーマレジストリの導入
```typescript
// lib/schema.ts
export const Schema = {
  Episodes: {
    table: TableNames.EPISODES,
    keys: { pk: "episodeId" },
    gsi: {
      byChildOccurredAt: {
        name: "childId-occurredAt-index",
        pk: "childId",
        sk: "occurredAt"
      }
    }
  },
  // ...
} as const;
```
Route から `Schema.Episodes.gsi.byChildOccurredAt.name` で参照。変更時は 1 ファイルのみ。

### P1（スケーラビリティ — 開発者追加・機能拡大前に対処すべき）

#### P1-1: Repository パターンの導入

**問題**: Route ハンドラが DynamoDB SDK に直結合しており、DB アクセスパターンの変更が全ルートに波及

**対策**: エンティティごとの Repository クラスを作成
```
lib/repositories/
  ├── episode-repository.ts    # findByChildId, findById, create, update, delete
  ├── tic-card-repository.ts   # findByChildId, findById, create, update, delete
  ├── medication-repository.ts # findByChildId + logs
  └── ...
```

**スコープ**: まず最も複雑な `episodes.ts` と `medications.ts` から着手。単純な CRUD（`users.ts`）は後回しでも良い。

#### P1-2: Service Layer の拡充

**問題**: `ChildService` のみで、残り 9 ルートのビジネスロジックが Route に混在

**対策**: ADR 012 に従い、以下を優先的に Service 化
- `EpisodeService`: カスケード削除 + AI ラベル正規化 + フィードバック処理
- `MedicationService`: カスケード削除 + ログ集計
- `DashboardService`: `aggregation.ts` のロジックをラップ

#### P1-3: labelStatus 等の Enum 共有

**問題**: FE が `"analyzing"`, `"ai_suggested"` 等の文字列リテラルをハードコード

**対策**: `shared/types.ts` に const enum を定義
```typescript
export const LabelStatus = {
  PENDING: "pending",
  ANALYZING: "analyzing",
  AI_SUGGESTED: "ai_suggested",
  CONFIRMED: "confirmed",
  EDITED: "edited",
  FAILED: "failed",
} as const;
export type LabelStatus = typeof LabelStatus[keyof typeof LabelStatus];
```

#### P1-4: 認可パターンの統一

**問題**: `verifyChildOwnership()`, `getOwnedChild()`, `videos.ts` 独自実装の 3 パターンが混在

**対策**:
- `getOwnedChild()` に統一（所有権検証 + エンティティ返却を 1 関数で）
- `videos.ts` の独自 `verifyOwnership()` を削除し、共通関数を使用
- Route 内のインライン所有権チェック（`episodes.ts` の 3 箇所）を削除

### P2（品質向上 — 時間があれば対処）

#### P2-1: API コントラクトの明示化

**対策**: OpenAPI スキーマまたは Zod スキーマで API レスポンス形式を定義し、FE 側でランタイムバリデーション

#### P2-2: SWR キーレジストリ

**対策**: `src/lib/api/keys.ts` にキーファクトリ関数を集約
```typescript
export const apiKeys = {
  children: () => "/children",
  ticCards: (childId: string) => `/children/${childId}/tic-cards`,
  episodes: (childId: string, from: string, to: string) =>
    `/children/${childId}/episodes?from=${from}&to=${to}`,
  // ...
};
```

#### P2-3: 入力バリデーションの統一

**対策**:
- `life-events.ts` の `JSON.parse` を `parseJsonBody()` に置換
- Enum バリデーション用のヘルパー（`validateEnum(value, allowed)`）を `validation.ts` に追加
- `episodes.ts:89` の `ForbiddenError` を `ValidationError` に修正

#### P2-4: users.ts の PutCommand → UpdateCommand 修正

**対策**: `PutCommand` を `UpdateCommand` に変更し、未送信フィールドの消失を防止

#### P2-5: CORS・ネットワークの本番対応

**対策**:
- CORS `"*"` → Amplify Hosting ドメインに制限
- AgentCore ネットワーク: PUBLIC → VPC
- ECR イメージタグ: `latest` → immutable tag（コミットハッシュ等）

---

## 6. 段階的な改善方針

### Phase 1: 基盤整備（P0 対応）

**目標**: スキーマ変更・削除操作の安全性を確保

1. `lib/schema.ts` を作成し、全 GSI 名・キー構造を定義
2. 既存 Route の GSI 名参照をスキーマレジストリ経由に置換
3. Episode / Medication のカスケード削除に TransactWriteItems を適用
4. Child 削除を論理削除に変更（`deletedAt` フラグ）

**影響範囲**: `lib/` 新規 + `routes/*.ts` の GSI 参照を置換（ロジック変更なし）
**テスト**: 既存テストが通ることを確認 + カスケード削除の失敗ケーステストを追加

### Phase 2: レイヤー分離（P1 対応）

**目標**: Route と DB アクセスの分離、Service Layer の拡充

1. `lib/repositories/` を作成（Episode, TicCard, Medication, LifeEvent, Child）
2. Repository は Phase 1 のスキーマレジストリを使用
3. Route ハンドラから DynamoDB SDK import を除去、Repository 呼び出しに置換
4. `EpisodeService`, `MedicationService` を作成し、カスケード削除・正規化ロジックを移動
5. 認可パターンを `getOwnedChild()` に統一
6. `shared/types.ts` に `LabelStatus` 等の Enum を追加

**影響範囲**: `routes/*.ts` のリファクタリング（外部 API は変更なし）
**テスト**: Repository の単体テスト追加 + 既存 Route テストが通ることを確認

### Phase 3: 契約強化（P2 対応）

**目標**: FE↔BE の契約を明示化し、変更時の安全性を向上

1. SWR キーレジストリの作成
2. 入力バリデーションの統一
3. API レスポンススキーマの定義（Zod / OpenAPI）
4. 本番向け CORS・ネットワーク設定
5. `users.ts` の PutCommand 修正

**影響範囲**: FE ユーティリティ追加 + BE バリデーション修正
**テスト**: E2E テストで API 契約を検証

---

## 付録: ファイル別リスクマップ

| ファイル | リスク | 理由 |
|----------|--------|------|
| `routes/episodes.ts` | 🔴 High | 最も複雑なルート。カスケード削除・AI ラベル正規化・3 箇所のインライン認可チェック |
| `services/child-service.ts` | 🔴 High | 7 テーブルのカスケード削除にトランザクションなし |
| `routes/medications.ts` | 🟡 Medium | カスケード削除 + 2 エンティティ（Card/Log）の管理 |
| `routes/videos.ts` | 🟡 Medium | 認可を独自再実装 + S3 プリサインド URL 生成 |
| `lib/aggregation.ts` | 🟡 Medium | 245 行の集計ロジックが DB 構造に直結合 |
| `routes/life-events.ts` | 🟡 Medium | parseJsonBody 未使用 + 手動バリデーション |
| `routes/tic-cards.ts` | 🟢 Low | 標準的 CRUD だが UpdateExpression の重複 |
| `routes/children.ts` | 🟢 Low | Service に委譲済み（削除）、CRUD は標準的 |
| `routes/users.ts` | 🟡 Medium | PutCommand による上書きリスク |
| `routes/dashboard.ts` | 🟢 Low | aggregation.ts に委譲済み |
| `routes/demo.ts` | 🟢 Low | ハードコードデモデータ、本番影響なし |
| `src/components/timeline/timeline-day-group.tsx` | 🟡 Medium | originalAILabel の string/object 分岐が BE 内部表現に結合 |
| `src/components/episodes/ai-label-section.tsx` | 🟡 Medium | videoS3Key 直接参照 + labelStatus 文字列比較 |

---

## 付録: Secret スキャン結果

**スキャン日時**: 2026-03-15
**スキャン対象**: リポジトリ全体（コード、設定ファイル、Git 履歴）

### 結論: CRITICAL な Secret 漏洩はなし

| 項目 | 状態 | 深刻度 |
|------|------|--------|
| AWS Access Key / Secret Key のハードコード | なし | - |
| パスワード / API キーのハードコード | なし | - |
| .env ファイルのコミット | なし（.gitignore 済み） | - |
| DB 接続文字列 | なし | - |
| Git 履歴の秘密ファイル (.env, .pem, .key) | なし | - |
| `amplify_outputs.json` にアカウント ID・Cognito ID | **あり** | ⚠️ WARNING |
| `analyze_video.py` でアクセスキー先頭10文字をログ出力 | **あり** | ⚠️ WARNING |
| `.amplify/generated/` の AWS 環境変数名 | 型宣言のみ（値なし） | INFO |
| デモユーザー ID のハードコード | 意図的（ADR 010 に記載） | INFO |

### 詳細

#### ⚠️ `amplify_outputs.json` — アカウント ID・リソース識別子の露出

**ファイル**: `amplify_outputs.json`（リポジトリルート）

コミットされたファイルに以下の実環境情報が含まれている:
- AWS アカウント ID: `728291782722`
- Cognito User Pool ID: `ap-northeast-1_k1nZn5TA4`
- Cognito User Pool Client ID: `4mcmlk6nfpsev1k7sdq61eoldi`
- Identity Pool ID: `ap-northeast-1:6a7c7624-9aab-4f40-923c-a7082d11848d`
- S3 バケット名、ECR リポジトリ URI、AgentCore Runtime ARN、IAM ロール ARN

`.gitignore` に「Committed mock for CI, real one generated locally」とコメントがあるが、**値が実環境のものであれば**、アカウント ID + Cognito Client ID の組み合わせは認証試行の足がかりになりうる。

**対策案**:
- CI 用のダミー値に差し替え（`000000000000` 等）
- または `.gitignore` に追加し、CI では `ampx generate outputs` で動的生成

#### ⚠️ `analyze_video.py:36` — アクセスキーの部分ログ出力

**ファイル**: `agents/tic_labeling/tools/analyze_video.py:36`

```python
logger.info(f"Credentials found: Access Key starts with {credentials.access_key[:10]}...")
```

デバッグ目的で AWS アクセスキーの先頭10文字を CloudWatch Logs に出力している。キー全体ではないが、**本番環境では不要であり削除すべき**。IAM ロール由来の一時キーであっても、ログに残るのは望ましくない。

**対策**: この行を削除、または `logger.debug()` に変更し本番ログレベルで出力されないようにする

#### INFO: その他の検出事項

- `.amplify/generated/env/*.ts`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 等の型宣言があるが、これは Amplify が自動生成する Lambda 環境変数の型定義であり、**値は含まれていない**。問題なし。
- `src/app/auth/page.tsx`: `password` はフォーム入力のローカル変数名。ハードコードされた値ではない。問題なし。
- テストファイルの `mock-jwt-token`, `apiKey: null` 等はモック値。問題なし。
