# TicTrack アーキテクチャ改善計画

> **バージョン**: 1.0
> **作成日**: 2026-03-12
> **基準**: アーキテクチャレビュー (2026-03-12 実施)
> **参照**: `docs/design/architecture_final.md`（最終アーキテクチャ設計書）

---

## 概要

本ドキュメントは、TicTrack リポジトリのアーキテクチャレビューで特定された改善項目について、具体的な実装方針を定義する。各項目は優先度（P0/P1/P2）とフェーズに分類し、段階的に適用する。

### フェーズ定義

| フェーズ | 時期 | 目的 |
|----------|------|------|
| Phase 1 | 即時（1-2日） | セキュリティ脆弱性の修正 |
| Phase 2 | デモ後〜チーム拡大前 | 開発基盤の安定化 |
| Phase 3 | プロダクション前 | アーキテクチャ強化 |
| Phase 4 | 本番リリース前 | 運用基盤整備 |

### 開発アプローチ: TDD の適用方針

本プロジェクトは TDD（Red-Green-Refactor）を基本とする。改善項目ごとの開発アプローチは以下の3分類とし、各項目に明記する。

| アプローチ | 説明 | 対象 |
|-----------|------|------|
| **TDD** | テストを先に書き、失敗を確認してから実装する（Red → Green → Refactor） | 新機能追加、セキュリティ修正、新ユーティリティ |
| **リファクタリング（テスト保護下）** | 既存テストをセーフティネットとして振る舞いを変えずに構造を改善する。既存テストが不足している場合はまずテストを追加する | コード整理、モジュール分割、責務移動 |
| **設定変更（手動検証）** | ユニットテストが困難なインフラ/設定変更。CDK アサーションテストまたは手動デプロイ検証で確認する | IaC 変更、環境変数、CORS 設定 |

---

## Phase 1: セキュリティ修正 (P0)

### 1.1 start-analysis Lambda の IDOR 修正

**問題**: `amplify/functions/start-analysis/handler.ts:46` でクライアント提供の `s3Key`, `bucketName`, `childId` をそのまま Step Functions に渡している。攻撃者が他人の `s3Key` を指定可能。

**対象ファイル**:
- `amplify/functions/start-analysis/handler.ts`

**開発アプローチ**: TDD

**TDD サイクル**:
1. **RED**: 以下のテストを先に書き、全て失敗することを確認する
   - 他人のエピソードIDを指定した場合に 403 が返るテスト
   - 存在しないエピソードIDに対して 404 が返るテスト
   - リクエストボディの `s3Key` を指定しても DB 上の値が使われるテスト
2. **GREEN**: ハンドラを修正し、全テストをパスさせる
   - リクエストボディから `s3Key`, `bucketName` を削除し、`episodeId` のみ受け取る
   - `episodeId` で Episodes テーブルを参照し、DB上の `videoS3Key` と `childId` を取得
   - 取得した `childId` → Children テーブルで `userId` を取得し、認証ユーザーと照合
   - DB上の値を Step Functions に渡す（クライアント提供値を信頼しない）
3. **REFACTOR**: エラーハンドリングの整理、不要になったリクエストボディパースの削除

**必要な追加**:
- `start-analysis` Lambda の環境変数に `CHILDREN_TABLE`, `MEDIA_BUCKET` を追加（`backend.ts`）
- IAM ポリシーに Children テーブルの `GetItem` 権限を追加

**テスト項目**:
- 自分のエピソードに対する分析開始が成功すること
- 他人のエピソードIDを指定した場合に 403 が返ること
- 存在しないエピソードIDに対して 404 が返ること
- リクエストボディの `s3Key` が無視されること

---

### 1.2 Video Playback の所有権チェック追加

**問題**: `amplify/functions/api-handler/routes/videos.ts:138-164` の `handleVideoPlaybackUrl()` で、エピソードが認証ユーザーの子供に属するかの検証がない。

**対象ファイル**:
- `amplify/functions/api-handler/routes/videos.ts`

**開発アプローチ**: TDD

**TDD サイクル**:
1. **RED**: 他人の子供のエピソード動画 URL 取得が 403 で拒否されるテストを書き、失敗を確認する
2. **GREEN**: `handleVideoPlaybackUrl()` の冒頭に `getUserId()` + `verifyChildOwnership()` を追加してパスさせる
3. **REFACTOR**: `handleVideoUploadUrl()` にも同様のチェックを追加（現状は S3 キー構造で保護されているが、明示的チェックを推奨）

**実装方針**:

ルートパスが `/children/{childId}/episodes/{episodeId}/video/playback` であるため、`childId` はパスパラメータから取得可能。

**前提**: Phase 2 の 2.1（`verifyChildOwnership` 共通化）が完了していない場合は、一時的にローカル関数として実装し、後で置き換える。

**テスト項目**:
- 自分の子供のエピソード動画 URL が取得できること
- 他人の子供のエピソード動画 URL が 403 で拒否されること
- `handleVideoUploadUrl()` にも同様のチェックが入っていることの確認

---

### 1.3 CORS の制限

**問題**: `handler.ts:8` と `backend.ts:156` で `Access-Control-Allow-Origin: "*"` が設定されている。

**対象ファイル**:
- `amplify/functions/api-handler/handler.ts` (Lambda レスポンスヘッダー)
- `amplify/functions/start-analysis/handler.ts` (同上)
- `amplify/backend.ts` (API Gateway CORS 設定)
- `amplify/custom/api/index.ts` (API Gateway Construct)

**開発アプローチ**: 設定変更（手動検証） + 部分的 TDD

CORS はインフラ設定が主体だが、Lambda レスポンスヘッダーの部分は TDD で検証可能。

**TDD 対象**:
1. **RED**: handler テストで `Access-Control-Allow-Origin` が環境変数の値と一致することを確認するテストを書き、失敗を確認
2. **GREEN**: Lambda ハンドラのヘッダーを `process.env.ALLOWED_ORIGIN` に置き換え
3. **手動検証**: API Gateway の CORS 設定は Sandbox デプロイ後にブラウザで確認

**実装方針**:

1. 環境変数 `ALLOWED_ORIGIN` を導入し、Lambda と API Gateway の両方で使用
2. Sandbox 環境では Amplify がデプロイする CloudFront URL を設定
3. ローカル開発では `http://localhost:3000` をデフォルトに設定
4. 各 Lambda の環境変数に `ALLOWED_ORIGIN` を追加し、レスポンスヘッダーで参照

**注意**: Amplify Sandbox 環境では `npx ampx sandbox` 起動時に CloudFront URL が確定する。初回は `*` で起動し、URL 確定後に環境変数を更新するフローが現実的。あるいは Amplify のデプロイ後フックで自動設定する。

**テスト項目**:
- 許可されたオリジンからのリクエストが成功すること
- 許可されていないオリジンからのリクエストが CORS エラーになること
- OPTIONS プリフライトリクエストが正しいヘッダーを返すこと

---

## Phase 2: 開発基盤整備 (P1)

### 2.1 認可ロジックの共通化

**問題**: `verifyChildOwnership()` が6ファイルに重複実装。命名・戻り値・エラーメッセージも不統一。

**現状の重複箇所**:

| ファイル | 関数名 | 行番号 | 戻り値 | エラーメッセージ |
|----------|--------|--------|--------|------------------|
| `routes/children.ts` | `getOwnedChild` | 67-87 | `Promise<Child>` | "Access denied" |
| `routes/episodes.ts` | `verifyChildOwnership` | 11-29 | `Promise<void>` | "Access denied" |
| `routes/tic-cards.ts` | `verifyChildOwnership` | 25-43 | `Promise<void>` | "Access denied" |
| `routes/medications.ts` | `verifyChildOwnership` | 23-41 | `Promise<void>` | "Access denied" |
| `routes/life-events.ts` | `verifyChildOwnership` | 273-287 | `Promise<void>` | "Access denied to this child's data" |
| `routes/dashboard.ts` | `verifyChildOwnership` | 103-117 | `Promise<void>` | "Access denied to this child's data" |

**対象ファイル**:
- 新規: `amplify/functions/api-handler/lib/authorization.ts`
- 変更: 上記6ファイルすべて

**開発アプローチ**: TDD（新モジュール） + リファクタリング（テスト保護下）

新しい `lib/authorization.ts` は TDD で作成し、既存ルートからの移行は既存テストをセーフティネットとしたリファクタリングで行う。

**TDD サイクル（新モジュール作成）**:
1. **RED**: `lib/authorization.ts` の単体テストを先に書く
   - 存在しない childId → NotFoundError
   - userId が一致しない → ForbiddenError
   - 正常系 → void 返却 / Child 返却
2. **GREEN**: `lib/authorization.ts` を実装してテストをパスさせる
3. **REFACTOR**: エラーメッセージの統一

**リファクタリング（既存ルート移行）**:
1. 既存の全ルートテストが通ることを事前確認（セーフティネット）
2. 各ルートファイルのローカル関数を削除し、import に置き換え
3. 全テストが変わらず通ることを確認

**実装方針**:

`lib/authorization.ts` に2つのバリエーションを共通ライブラリとして定義する:
- `verifyChildOwnership(childId, userId): Promise<void>` — 検証のみ
- `getOwnedChild(childId, userId): Promise<Child>` — 検証 + Child返却

**テスト項目**:
- `lib/authorization.ts` 単体テスト（NotFoundError, ForbiddenError, 正常系）
- 既存の全ルートテストがそのまま通ること（リファクタリングなので振る舞いは変えない）

---

### 2.2 Router パラメータマッピングの修正

**問題**: `router.ts:181-186` で `match[2]` が `cardId`, `episodeId`, `medicationId`, `logId` に同時代入される。現在は各ハンドラが必要なキーだけ使うため動作するが、ルート追加時に意図しないパラメータ参照が起きるリスクが高い。

**対象ファイル**:
- `amplify/functions/api-handler/router.ts`
- `amplify/functions/api-handler/types.ts`（RouteDefinition の型を拡張）

**開発アプローチ**: TDD

**TDD サイクル**:
1. **RED**: Router の `paramNames` ベースマッピングのテストを先に書く
   - `/children/{childId}` で `params.childId` のみ設定されること
   - `/children/{childId}/episodes/{episodeId}` で両方設定されること
   - `params` に不要なキー（`cardId`, `logId` 等）が含まれないこと
2. **GREEN**: `RouteDefinition` に `paramNames` を追加し、`route()` 関数を書き換えてパスさせる
3. **REFACTOR**: 全ルート定義に `paramNames` を追加し、フォールバックの暗黙マッピングを削除

**実装方針**:

`RouteDefinition` に `paramNames?: string[]` を追加し、正規表現のキャプチャグループとパラメータ名を1対1で動的にマッピングする。全ルート定義に `paramNames` を付与し、暗黙マッピングを廃止する。

**移行手順**:
1. `RouteDefinition` 型に `paramNames` を optional で追加
2. `route()` 関数の params 構築を `paramNames` ベースに書き換え（フォールバック付き）
3. 全ルート定義に `paramNames` を追加
4. 従来のフォールバック暗黙マッピングを削除
5. 全テストがパスすることを確認

**テスト項目**:
- 各ルートパターンで正しいパラメータ名にマッピングされること
- ネストしたルート（`/children/{childId}/episodes/{episodeId}`）で両方のパラメータが取れること
- `paramNames` 未定義のルートでフォールバック動作すること（移行中の互換性）

---

### 2.3 環境変数のバリデーション

**問題**: `lib/dynamodb.ts:11-22` で `process.env.USERS_TABLE!` のように非nullアサーションを使用。環境変数未設定時にランタイムで暗号的なエラーになる。

**対象ファイル**:
- `amplify/functions/api-handler/lib/dynamodb.ts`
- `amplify/functions/start-analysis/handler.ts`
- `amplify/functions/agentcore-proxy/handler.ts`

**開発アプローチ**: TDD

**TDD サイクル**:
1. **RED**: `requireEnv()` 関数のテストを先に書く
   - 環境変数が設定されている場合に値を返すこと
   - 環境変数が未設定の場合に変数名を含むエラーメッセージで throw すること
2. **GREEN**: `requireEnv()` を実装してパスさせる
3. **REFACTOR**: `TableNames` の初期化を `requireEnv()` に置き換え、既存テストで動作確認

**実装方針**:

`requireEnv(name: string): string` ヘルパー関数を導入し、Lambda の初期化フェーズ（モジュールトップレベル）で環境変数をバリデーションする。未設定時は変数名を含む明示的なエラーメッセージで即座に失敗させる。

**効果**: 環境変数の欠如がLambda初期化時（コールドスタート時）に即座に検出され、CloudWatch Logs で明確なエラーメッセージが記録される。

**テスト項目**:
- 環境変数が全て設定されている場合に正常初期化されること
- 環境変数が1つでも欠けている場合に明示的なエラーメッセージで失敗すること

---

### 2.4 DynamoDB テーブル名の動的化

**問題**: `amplify/custom/database/index.ts` で全11テーブルが `tableName: "Users"` のようにハードコード。複数環境でテーブル名が衝突する。

**対象ファイル**:
- `amplify/custom/database/index.ts`

**開発アプローチ**: 設定変更（CDK アサーションテストで検証）

CDK Construct の変更はユニットテストが困難だが、Phase 4 の 4.3（CDK インフラテスト）と併せて `aws-cdk-lib/assertions` でプレフィックス付与を検証する。

**実装方針**:

**方針: スタック名プレフィックス付与（推奨）**

`DatabaseConstruct` のプロパティに `tablePrefix?: string` を追加し、`Stack.of(this).stackName` またはプロパティから取得したプレフィックスをテーブル名に付与する。Amplify Sandbox では `amplify-{appId}-{branch}-{sandbox}-database-stack-Users` のような名前になり、環境ごとに一意かつコンソールでも識別可能。

> 方針Bとして CDK 自動生成（`tableName` 省略）も検討したが、テーブル名がランダム文字列になり AWS コンソールでの視認性が悪化するため不採用。

**注意**: Amplify Sandbox の `stackName` が長すぎると DynamoDB のテーブル名制限（255文字）に引っかかる可能性がある。プレフィックスの短縮ロジックが必要になる場合がある。

**移行手順**:
1. `DatabaseConstruct` のプロパティに `tablePrefix?: string` を追加
2. テーブル生成部分でプレフィックスを付与
3. `backend.ts` でプレフィックスを渡す（Sandbox名から派生）
4. Lambda 環境変数は既に個別テーブル名を渡しているため、アプリケーションコード変更不要
5. **注意**: 既存の Sandbox 環境ではテーブルが再作成されるため、デモデータの再投入が必要

**テスト項目**:
- 異なるプレフィックスで2つの DatabaseConstruct を作成し、テーブル名が衝突しないこと（CDK スナップショットテスト）
- Lambda が新しいテーブル名で正常動作すること

---

### 2.5 RemovalPolicy の環境切り替え

**問題**: 全リソースが `RemovalPolicy.DESTROY` で、本番スタック削除時にデータ全消失のリスク。

**対象ファイル**:
- `amplify/custom/database/index.ts`
- `amplify/custom/foundation/index.ts`
- `amplify/custom/agentcore/index.ts`
- `amplify/custom/orchestration/index.ts`

**開発アプローチ**: 設定変更（CDK アサーションテストで検証）

2.4 と同様、CDK アサーションテストで `isProduction` フラグによる RemovalPolicy / PITR の切り替えを検証する。

**実装方針**:

各 Construct のプロパティに `isProduction?: boolean` を追加し、環境変数 `STAGE` で判定する。本番環境では `RemovalPolicy.RETAIN` + PITR 有効化、開発環境では `RemovalPolicy.DESTROY` を維持する。`backend.ts` で `process.env.STAGE === "prod"` を判定し、各 Construct に渡す。

**テスト項目**:
- `isProduction: true` で RETAIN ポリシーが設定されること（CDK アサーションテスト）
- `isProduction: false` で DESTROY ポリシーが設定されること
- PITR が本番環境のみ有効であること

---

## Phase 3: アーキテクチャ強化 (P2)

### 3.1 型定義の単一ソース化

**問題**: `src/lib/types.ts` (232行) と `amplify/functions/api-handler/types.ts` (134行) でドメイン型が二重定義。

**対象ファイル**:
- 新規: `shared/types.ts`
- 変更: `src/lib/types.ts`, `amplify/functions/api-handler/types.ts`

**開発アプローチ**: リファクタリング（テスト保護下）

型定義の移動は振る舞いを変えないリファクタリング。既存の FE ビルド（`npm run build`）と BE テスト（`npm run test`）をセーフティネットとして使用する。

**実装方針**:

**方針: 共有ディレクトリ + tsconfig paths + re-export**

`shared/types.ts` にドメイン型の単一ソースを配置し、FE/BE 各 `types.ts` はそれを re-export しつつ、各層固有の型（FE: `DashboardData`, BE: `RouteDefinition` 等）をローカルに定義する。`tsconfig.json` のパスエイリアスで参照を解決する。

**ディレクトリ構成**:
```
project-root/
├── shared/
│   └── types.ts          ← 単一ソース（ドメイン型）
├── src/lib/types.ts      ← re-export + FE固有型
├── amplify/functions/api-handler/types.ts ← re-export + BE固有型
```

**リスク**:
- Amplify Gen 2 の `defineFunction()` が `shared/` ディレクトリを Lambda バンドルに含めない可能性がある。その場合は esbuild 設定でエイリアスを追加するか、ビルド前コピースクリプトを用意する。

**移行手順**:
1. `shared/types.ts` を作成し、両ファイルの共通型を移動
2. FE/BE 各 `types.ts` を re-export 形式に変更
3. `tsconfig.json` にパスエイリアスを設定
4. ビルドが通ることを確認（`npm run build`）
5. Lambda バンドル（esbuild）が shared を正しく解決することを確認

**テスト項目**:
- `npm run build` でフロントエンドがビルドできること
- `npx ampx sandbox` でバックエンドがデプロイできること
- 型の変更が両方に反映されること

---

### 3.2 フロントエンド状態管理の統一

**開発アプローチ**: リファクタリング（テスト保護下）

フック内部の実装を SWR に置き換えるが、戻り値のインターフェースは維持する。既存のコンポーネントテストと E2E テストをセーフティネットとして使用する。フック単体テストが不足している場合は、SWR 化の前にまず既存の振る舞いを検証するテストを追加する。

**問題**: 6つのデータフェッチフックのうち5つが手動 `useState` + `useEffect`、1つのみ SWR。キャッシュ共有なし。

**現状**:

| フック | 方式 | キャッシュ | 自動再検証 |
|--------|------|-----------|-----------|
| `use-children.ts` | useState + useEffect | なし | なし |
| `use-tic-cards.ts` | useState + useEffect | なし | なし |
| `use-episodes.ts` | useState + useEffect | なし | なし |
| `use-medications.ts` | useState + useEffect | なし | なし |
| `use-life-events.ts` | useState + useEffect | なし | なし |
| `use-dashboard.ts` | SWR | 30秒dedup | あり |

**対象ファイル**:
- `src/hooks/use-children.ts`
- `src/hooks/use-tic-cards.ts`
- `src/hooks/use-episodes.ts`
- `src/hooks/use-medications.ts`
- `src/hooks/use-life-events.ts`

**実装方針**:

既に `swr` が依存に含まれているため、全フックを SWR に統一する。各フックで `useSWR` による読み取り + ミューテーション関数（Optimistic Update 付き）を実装する。戻り値のインターフェースを維持すれば、呼び出し元のコンポーネント変更は不要。

**メリット**:
- キャッシュ共有: 同じ URL のリクエストが自動で deduplicate
- Optimistic update: ミューテーション結果を即座にUIに反映
- 自動再検証: フォーカス復帰時やネットワーク復帰時に最新データ取得

**移行手順**:
1. `use-children.ts` を SWR 化（最もシンプルなフック）
2. テスト + 動作確認
3. 残り4フックを順次 SWR 化
4. 各フックの既存テストがパスすることを確認

**テスト項目**:
- 各フックの CRUD 操作が正常動作すること
- `childId` が未定義の場合にフェッチしないこと（SWR の conditional fetching）
- ミューテーション後にキャッシュが更新されること

---

### 3.3 ドメインサービス層の導入

**問題**: ビジネスロジック（所有権チェック、カスケード削除、ステータス遷移）がルートハンドラに直書きされている。新しいエントリポイント追加時にルール漏れのリスク。

**対象ファイル**:
- 新規: `amplify/functions/api-handler/services/child-service.ts`
- 新規: `amplify/functions/api-handler/services/episode-service.ts`
- 変更: `routes/children.ts`, `routes/episodes.ts` 等

**開発アプローチ**: TDD（新サービス） + リファクタリング（テスト保護下）

新しいサービスクラスは TDD で作成する。ルートハンドラからサービスへのロジック移動は、既存テストをセーフティネットとしたリファクタリングで行う。

**TDD サイクル（`ChildService` の例）**:
1. **RED**: `ChildService.deleteChildCascade()` のテストを先に書く
   - 所有権チェックが行われること
   - TicCards → Episodes → AILabels → ... → Child の順に削除されること
   - 途中失敗時にエラーがスローされること
   - 他人の子供に対して ForbiddenError がスローされること
2. **GREEN**: `ChildService` を実装してテストをパスさせる
3. **REFACTOR**: `routes/children.ts` の `deleteChild` ハンドラをサービス呼び出しに書き換え、既存ルートテストが通ることを確認

**実装方針**:

段階的にサービス層を導入する。最初は最もビジネスロジックが複雑な「子供の削除（カスケード）」と「エピソードの分析開始」から着手する。

ルートハンドラはHTTPリクエストの解析・レスポンスの構築のみ担当し、ビジネスロジックはサービスクラスに委譲する。サービスクラスは `lib/authorization.ts` を使用して認可を統一的に処理する。

**段階的導入計画**:
1. Phase 3 初期: `ChildService.deleteChildCascade()` のみ抽出
2. Phase 3 中期: `EpisodeService.startAnalysis()` を抽出（start-analysis Lambda からも呼べるように）
3. Phase 3 後期: 残りの CRUD 操作を必要に応じてサービスに移行

**テスト項目**:
- サービス単体テスト（DynamoDB モック使用）
- カスケード削除の途中失敗時にエラーがスローされること
- 既存のルートテストが変わらず通ること

---

### 3.4 集計ロジックの統一

**問題**: ダッシュボード集計が TypeScript (`lib/aggregation.ts`) と Python (`report-aggregator/handler.py`) で二重実装。ロジック乖離のリスク。

**対象ファイル**:
- `amplify/functions/api-handler/lib/aggregation.ts`
- `amplify/functions/report-aggregator/handler.py`

**開発アプローチ**: TDD（新 Lambda）+ リファクタリング（テスト保護下）

新しい TypeScript 集計 Lambda は TDD で作成する。既存の `aggregation.ts` のテストはそのまま維持し、Python 側のテストは WeeklyReports テーブルからの読み取りに書き換える。

**実装方針**:

**TypeScript 版を正規実装**とし、Python 版は集計済みデータを参照する形にする。

Weekly Reports のバッチ処理（Step Functions）で TypeScript Lambda が集計を実行し、結果を WeeklyReports テーブルに保存する。Python の report-generator はこの保存済み集計データを読み取ってレポート（PDF）を生成する。

```
Step Functions ワークフロー:
  1. [TypeScript Lambda] 集計実行 → WeeklyReports テーブルに保存
  2. [Python Lambda] WeeklyReports から集計結果を読み取り → PDF生成
```

**メリット**:
- 集計ロジックが TypeScript に一元化
- Python は PDF 生成に専念（Strands Agent + pdfkit）
- 集計結果がキャッシュされるため、ダッシュボードからも参照可能

**テスト項目**:
- TypeScript 集計関数の単体テスト（既存テストを維持）
- Python が WeeklyReports テーブルから正しくデータを読み取れること
- ダッシュボードと Weekly Report の数値が一致すること

---

### 3.5 API Client の分割とデモモード分離

**問題**: `src/lib/api.ts` (342行) にデモモード判定・URL書き換え・ミューテーション遮断・認証・全エンドポイント関数が混在。

**対象ファイル**:
- `src/lib/api.ts`
- 新規: `src/lib/api/client.ts`, `src/lib/api/demo-client.ts`, `src/lib/api/index.ts`, 機能別ファイル

**開発アプローチ**: TDD（新クライアントモジュール） + リファクタリング（テスト保護下）

`client.ts` と `demo-client.ts` のコア機能は TDD で作成する。既存の `api.ts` からの移行は、既存テストと E2E テストをセーフティネットとして行う。

**TDD サイクル**:
1. **RED**: `demo-client.ts` のテストを先に書く
   - GET リクエストに `/demo` プレフィックスが付くこと
   - POST/PUT/DELETE で 403 エラーがスローされること
   - Authorization ヘッダーが付与されないこと
2. **GREEN**: `demo-client.ts` を実装してパスさせる
3. **REFACTOR**: `client.ts`（認証クライアント）も同様に TDD で作成後、`api.ts` を分割してモジュール化

**実装方針**:

`src/lib/api/` ディレクトリに分割する:

```
src/lib/api/
├── client.ts        ← apiClient() の本体（認証、エラーハンドリング）
├── demo-client.ts   ← デモ用の apiClient()（URLプレフィックス、ミューテーション遮断）
├── index.ts         ← モード判定して適切なクライアントをエクスポート
├── children.ts      ← Child 関連 API 関数
├── episodes.ts      ← Episode 関連 API 関数
├── medications.ts   ← Medication 関連 API 関数
├── life-events.ts   ← LifeEvent 関連 API 関数
└── ai-labels.ts     ← AI Label 関連 API 関数
```

`index.ts` がデモモード判定を一箇所で行い、認証クライアントまたはデモクライアントを選択する。機能別ファイルはクライアントを使って個別のAPI呼び出しを定義する。

**テスト項目**:
- 認証クライアントがトークンを付与すること
- デモクライアントがミューテーションを遮断すること
- 機能別 API 関数が正しいクライアントを使用すること

---

### 3.6 backend.ts の構造化

**問題**: `backend.ts` (403行) が全リソースのワイヤリング・IAMポリシー・環境変数・コメントアウトされた将来ステップを一手に担う巨大ファイル。

**対象ファイル**:
- `amplify/backend.ts`
- 新規: `amplify/config/auth.ts`, `amplify/config/database.ts`, `amplify/config/api.ts` 等

**開発アプローチ**: リファクタリング（テスト保護下）

IaC のリファクタリングは Sandbox デプロイの成功をセーフティネットとする。分割前後で `npx ampx sandbox` が同一リソースを生成することを確認する。Phase 4 の CDK アサーションテスト（4.3）が先行して整備されていれば、それもセーフティネットとして活用する。

**実装方針**:

ステップ別の設定関数に分割し、`backend.ts` はオーケストレーションのみ担当する。各設定関数は対応する CDK Construct の作成・環境変数設定・IAMポリシー付与を一括で行う。

```
amplify/config/
├── auth.ts       ← Cognito 設定（CfnUserPool override 等）
├── database.ts   ← DatabaseConstruct + Lambda 環境変数 + IAM
├── api.ts        ← ApiConstruct + start-analysis Lambda
├── ai.ts         ← AgentCore + agentcore-proxy 設定（Step 4+）
└── orchestration.ts ← Step Functions + 関連 IAM（Step 6+）
```

`backend.ts` は `defineBackend()` + 各設定関数の呼び出しのみとなり、50行以下に収まる。ステップの有効化は設定関数の呼び出しコメント1行の切り替えで済む。

**メリット**:
- 各設定ファイルが100行以下になり、見通しが良くなる
- 設定ファイル単位でのコードレビューが容易
- コンフリクトリスクの低減

---

## Phase 4: 運用基盤整備

### 4.1 構造化ログ + PII フィルタリング

**問題**: `console.log` でリクエストボディやエラーオブジェクトがそのまま出力される。PII（個人情報）がCloudWatch Logsに残るリスク。

**対象ファイル**:
- `amplify/functions/api-handler/handler.ts`
- `amplify/functions/api-handler/router.ts`
- `amplify/functions/api-handler/routes/videos.ts`
- `amplify/functions/start-analysis/handler.ts`

**開発アプローチ**: TDD（サニタイズ関数）+ リファクタリング（テスト保護下）

`sanitizeForLog()` 関数は TDD で作成する。既存の `console.log` を Logger に置き換える部分は既存テストをセーフティネットとしたリファクタリング。

**TDD サイクル**:
1. **RED**: `sanitizeForLog()` のテストを先に書く — PII フィールドが `[REDACTED]` に置換されること、非 PII フィールドはそのまま残ること
2. **GREEN**: 実装してパスさせる
3. **REFACTOR**: `console.log` → `logger.info(sanitizeForLog(...))` に置き換え

**実装方針**:

1. `@aws-lambda-powertools/logger` を導入し構造化ログに切り替え
2. PII フィールド（`displayName`, `notes`, `context`, `customSymptom`）をマスクするサニタイズ関数を `lib/logger.ts` に配置
3. リクエストボディの直接ログ出力を削除または制限

### 4.2 監視・アラート設定

**実装方針**:
- CloudWatch Alarms で Lambda エラー率 > 5% をアラート
- DynamoDB ThrottledRequests > 0 をアラート
- API Gateway 5xx エラー率をアラート
- SNS トピック経由でメール通知

### 4.3 CDK インフラテスト

**対象ファイル**:
- 新規: `amplify/custom/__tests__/database.test.ts`
- 新規: `amplify/custom/__tests__/api.test.ts`

**開発アプローチ**: TDD

IaC 変更の安全性を担保するため、CDK アサーションテストを TDD で整備する。Phase 2 の 2.4/2.5 で追加した `tablePrefix` や `isProduction` の振る舞いを検証する。このテスト群は、以降の IaC リファクタリング（3.6 等）のセーフティネットとしても機能する。

**TDD サイクル**:
1. **RED**: 現在の Construct の期待仕様をテストとして書く（テーブル数、ビリング、GSI 数等）
2. **GREEN**: 既存の Construct でそのまま通ることを確認（既存仕様の文書化）
3. **追加 RED**: `isProduction: true` で PITR / RETAIN が有効になるテストを書き、失敗を確認
4. **追加 GREEN**: Phase 2 の変更が正しく反映されていることを確認

**実装方針**:

`aws-cdk-lib/assertions` の `Template` を使用し、CDK スナップショットテストとプロパティアサーションテストを実装する。主要なテスト対象:
- テーブル数が11であること
- 全テーブルが PAY_PER_REQUEST であること
- `isProduction: true` で PITR と RETAIN が有効であること
- API Gateway に Cognito Authorizer が設定されていること

### 4.4 入力サニタイズ + 自由テキスト長制限

**対象ファイル**:
- `amplify/functions/api-handler/lib/validation.ts`

**開発アプローチ**: TDD

**TDD サイクル**:
1. **RED**: `validateFreeText()` のテストを先に書く
   - 2000文字以内の文字列がそのまま返ること
   - 2001文字以上で ValidationError がスローされること
   - HTML タグが除去されること（`<script>alert(1)</script>` → `alert(1)`）
   - 前後の空白が trim されること
   - 空文字列の許可/拒否が `required` オプションで制御できること
2. **GREEN**: `validateFreeText()` を実装してパスさせる
3. **REFACTOR**: ルートハンドラの `notes`, `context`, `description` フィールドに適用し、既存テストが通ることを確認

**実装方針**:

`validateFreeText(value, fieldName, maxLength)` 関数を追加し、自由テキストフィールド（`notes`, `context`, `description`）に長さ制限（デフォルト2000文字）と基本的な HTML タグ除去を適用する。ルートハンドラの該当フィールドでこのバリデーションを使用する。

---

## 実装チェックリスト

凡例: 🔴 TDD | 🔄 リファクタリング（テスト保護下） | ⚙️ 設定変更（手動検証/CDKテスト）

### Phase 1 (P0 - 即時)
- [x] 🔴 1.1 start-analysis IDOR 修正
- [x] 🔴 1.2 Video playback 所有権チェック追加
- [ ] ⚙️ 1.3 CORS 制限（Lambda ヘッダー部分は部分的 TDD）

### Phase 2 (P1 - デモ後)
- [ ] 🔴🔄 2.1 認可ロジック共通化 — TDD で新モジュール作成 + リファクタリングで移行
- [ ] 🔴 2.2 Router パラメータマッピング修正
- [ ] 🔴 2.3 環境変数バリデーション
- [ ] ⚙️ 2.4 DynamoDB テーブル名動的化
- [ ] ⚙️ 2.5 RemovalPolicy 環境切り替え

### Phase 3 (P2 - プロダクション前)
- [ ] 🔄 3.1 型定義の単一ソース化
- [ ] 🔄 3.2 フロントエンド状態管理の SWR 統一
- [ ] 🔴🔄 3.3 ドメインサービス層の導入 — TDD で新サービス作成 + リファクタリングで移行
- [ ] 🔴🔄 3.4 集計ロジックの統一 — TDD で新 Lambda + リファクタリングで Python 側を修正
- [ ] 🔴🔄 3.5 API Client の分割とデモモード分離 — TDD で新クライアント + リファクタリングで移行
- [ ] 🔄 3.6 backend.ts の構造化

### Phase 4 (運用整備)
- [ ] 🔴🔄 4.1 構造化ログ + PII フィルタリング — TDD でサニタイズ関数 + リファクタリングで置き換え
- [ ] ⚙️ 4.2 監視・アラート設定
- [ ] 🔴 4.3 CDK インフラテスト
- [ ] 🔴 4.4 入力サニタイズ + 自由テキスト長制限

---

## 付録: 判断の根拠

### なぜ Phase 1 を最優先とするか
- `start-analysis` IDOR は認証済みユーザーが他人のビデオにアクセス可能な実害がある脆弱性
- Video playback も同様に IDOR
- CORS `*` はトークンを持つ攻撃者の攻撃範囲を広げる
- いずれもデモ環境であっても修正すべきセキュリティ問題

### なぜ型共有を Phase 3 にしたか
- Phase 2 の構造変更（Router 修正、認可共通化）が先行しないと、型共有のスコープが確定しない
- Amplify のバンドル設定との相性検証が必要で、時間を要する可能性がある
- 現時点で FE/BE の型は実質的に同期されており、即座に破綻するリスクは低い

### なぜドメインサービス層を Phase 3 にしたか
- Phase 2 の認可共通化が前提条件
- ルートハンドラの直書きはプロトタイプでは許容範囲
- チーム拡大時に初めて問題が顕在化するため、チーム拡大前に実施すれば十分
