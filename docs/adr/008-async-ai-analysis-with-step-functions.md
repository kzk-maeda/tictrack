# ADR 008: Step Functions による AI 分析の非同期化

## ステータス

承認済み（2026-03-09）

**更新**: ADR 009（2026-03-10）により、ワークフローの一部を変更：
- `StoreAILabel` ステートを削除（Agent の `store_label` ツールが直接保存）
- `UpdateEpisode` は `originalAILabel` を更新しない（`store_label` ツールが既に更新済み）

## 背景

AI 分析処理（AgentCore Runtime）が長時間かかり、API Gateway の 29 秒タイムアウトに引っかかる問題が発生。

### 問題の詳細
- AgentCore Runtime での分析: Nova Pro ビデオ分析 + Transcribe + 統合処理
- 処理時間: 60-90 秒（ビデオの長さに依存）
- API Gateway タイムアウト: 29 秒（変更不可）
- 結果: 504 Gateway Timeout エラー

### 選択肢 1: 非同期 + ポーリング（Lambda のみ）
- Lambda が即座に 202 Accepted を返す
- バックグラウンドで処理継続
- フロントエンドがポーリングで状態確認

**問題点**:
- Lambda の最大実行時間: 15 分
- エラーハンドリング、リトライが手動実装
- 実行状況の可視化が困難

### 選択肢 2: WebSocket
- API Gateway WebSocket で双方向通信
- 処理完了時にプッシュ通知

**問題点**:
- WebSocket 接続管理が複雑
- フロントエンドの状態管理が複雑
- コスト増加（接続維持）

### 選択肢 3: Step Functions + ポーリング
- Step Functions でワークフローを orchestrate
- Lambda を非同期で起動
- フロントエンドがポーリングで状態確認

**利点**:
- 自動リトライ、エラーハンドリング
- 実行状況の可視化（Step Functions Console）
- タイムアウト管理が容易
- 週次レポート生成（Step 6）でも再利用可能

### 選択肢 4: API Gateway タイムアウト延長
- 不可能（29 秒が上限）

## 決定

**Step Functions + ポーリングパターンを採用する。**

### アーキテクチャ

```
Frontend
  ↓ POST /analyze/{episodeId}
StartAnalysis Lambda (202 Accepted)
  ↓ StartExecution
Step Functions Workflow
  ├─ InvokeAgentCore Lambda (retry: 3 times)
  │    └─ Agent calls store_label tool
  │         ├─ AILabels テーブルに保存
  │         └─ Episodes.originalAILabel を更新
  ├─ UpdateEpisode (labelStatus = "ai_suggested" のみ更新)
  └─ MarkAsFailed (on error)

Frontend → GET /analysis-status (polling: 3 sec interval)
  ↓
Episodes Table (labelStatus: analyzing / ai_suggested / failed)
```

**注**: 2026-03-10 の ADR 009 により、`StoreAILabel` ステートを削除。
Agent の `store_label` ツールが AILabels と Episodes の両方を更新するため、
Step Functions での重複書き込みを排除。

### 実装詳細

1. **StartAnalysis Lambda**:
   - Step Functions execution を起動
   - Episodes テーブルに `labelStatus = "analyzing"`, `executionArn` を記録
   - 202 Accepted + executionArn を返す

2. **Step Functions ワークフロー**:
   - InvokeAgentCore: AgentCore Runtime 呼び出し（リトライ 3 回）
     - Agent が `store_label` ツールを呼び出し
     - AILabels テーブルと Episodes.originalAILabel を更新
   - UpdateEpisode: labelStatus を "ai_suggested", updatedAt を更新
     - **注**: originalAILabel は更新しない（store_label が既に更新済み）
   - MarkAsFailed: エラー時に labelStatus を "failed" に更新

3. **GetAnalysisStatus エンドポイント**:
   - Episodes テーブルから labelStatus を取得
   - ai_suggested の場合、AILabels も返す

4. **フロントエンド**:
   - 2 秒ごとにポーリング
   - 60 秒でタイムアウト
   - 状態に応じて UI を更新

## 結果

### ポジティブ
- ✅ API Gateway タイムアウト問題を完全解決
- ✅ エラーハンドリング、リトライが自動化
- ✅ 実行状況の可視化（Step Functions Console）
- ✅ 週次レポート生成（Step 6）でも再利用可能
- ✅ 本番環境でも使える堅牢性

### ネガティブ
- ❌ 実装が複雑（Lambda 3 つ + Step Functions + API 2 つ）
- ❌ ポーリングによる API 呼び出し増加
- ❌ Step Functions のコスト（月 1,000 回で $0.125）

### トレードオフ
- **シンプルさ** vs **堅牢性** → 堅牢性を優先
- **プッシュ通知** vs **ポーリング** → ポーリングを優先（実装が簡単）
- **コスト** vs **機能性** → 機能性を優先（コストは微増）

## コスト試算

月 1,000 回の AI 分析：
- Step Functions: $0.125
- StartAnalysis Lambda: $0.20
- GetAnalysisStatus API 呼び出し（30 回/分析）: $0.03
- **合計追加コスト: ~$0.35/月**（AgentCore コスト $30 に対して 1%）

## 技術的検証

- ✅ ローカルテスト: スクリプトで Step Functions 定義を検証
- ✅ Sandbox デプロイ: Type checks パス
- ✅ フロントエンド: ポーリングロジック実装・テスト完了

## 将来の拡張

### Step 6: 週次レポート生成
同じ Step Functions パターンを再利用：
- レポート生成は非同期（数分かかる）
- ポーリングで完了を確認
- PDF 生成完了後に S3 URL を返す

### モニタリング
- CloudWatch Metrics: 実行成功率、平均実行時間
- CloudWatch Alarms: 失敗率が閾値を超えた場合のアラート
- X-Ray Tracing: エンドツーエンドのトレース

## 関連 ADR

- [ADR 001: Strands Agents SDK + AgentCore Runtime の採用](./001-adopt-strands-agents-sdk.md)
- [ADR 002: Amplify Gen 2 + CDK への移行](./002-migrate-to-amplify-gen2-cdk.md)
- [ADR 009: AI ラベルデータ構造の修正と後方互換性](./009-ai-label-backward-compatibility.md) - ワークフロー改善
