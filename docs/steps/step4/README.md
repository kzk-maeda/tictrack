# Step 4: AI ラベリング基本

> **日程**: Day 10-13
> **前提**: Step 3 完了（動画キャプチャ + アップロード）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §8.1-8.7 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)
> **MVP ティア**: **最低限デモ (Minimum Demo)** 完了ステップ

---

## 目標

動画 → AI ラベル提案 → 親が確認/編集 → フィードバック記録。

---

## 前提条件

- Step 3 の動画キャプチャ + S3 アップロードが完了
- ECR リポジトリ作成済み（`amplify/custom/foundation/index.ts`）
- Python 3.12 + strands-agents インストール済み

---

## 成果物

### Python Agent (`agents/`)

| ファイル | 内容 |
|---------|------|
| `agents/tic_labeling/agent.py` | Tic Labeling Agent 定義 + FastAPI |
| `agents/tic_labeling/tools/analyze_video.py` | @tool: Nova Pro 動画分析 |
| `agents/tic_labeling/tools/transcribe_audio.py` | @tool: Amazon Transcribe |
| `agents/tic_labeling/tools/integrate_results.py` | @tool: 結果統合 |
| `agents/tic_labeling/tools/match_tics.py` | @tool: Claude Haiku 照合 |
| `agents/tic_labeling/tools/apply_guardrails.py` | @tool: Bedrock Guardrails |
| `agents/tic_labeling/tools/store_label.py` | @tool: DynamoDB 書き込み |
| `agents/tests/test_tic_labeling/` | pytest テスト群 |

### Amplify バックエンド追加

| ファイル | 内容 |
|---------|------|
| `amplify/functions/ai-proxy/resource.ts` | defineFunction — AI Proxy Lambda |
| `amplify/functions/ai-proxy/handler.ts` | Lambda Proxy → AgentCore HTTP |
| `amplify/custom/ai/index.ts` | AiConstruct — Guardrails + AgentCore IAM |

### Lambda API 追加

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/routes/analyze.ts` | AI 分析トリガー |
| `amplify/functions/api-handler/routes/ai-labels.ts` | AI ラベル結果取得 |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/episodes/[id]/page.tsx` | エピソード詳細（AI ラベル表示 + 確認/修正） |
| `src/components/ai-label/` | AI ラベル関連コンポーネント |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/children/{childId}/episodes/{episodeId}/analyze` | AI 分析トリガー |
| GET | `/children/{childId}/episodes/{episodeId}/ai-labels` | AI ラベル結果取得 |
| PUT | `/children/{childId}/episodes/{episodeId}` | ラベル確認/修正 + フィードバック記録 |

---

## Strands Agent アーキテクチャ

> 参照: `architecture_final.md` §8.1-8.2

### 呼び出しパターン

```
Frontend → API Gateway → Lambda api-handler → Lambda ai-proxy → AgentCore (Tic Labeling Agent)
```

### Agent 定義

```python
from strands import Agent
from strands.models.bedrock import BedrockModel

model = BedrockModel(model_id="amazon.nova-pro-v1:0")

agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
    tools=[analyze_video, transcribe_audio, integrate_results,
           match_existing_tics, apply_guardrails, store_label],
)
```

### @tool 仕様

| ツール | 入力 | 出力 | 使用サービス |
|--------|------|------|-------------|
| `analyze_video` | S3 URI, チックカード一覧 | 構造化 JSON（observations 配列） | Bedrock (Nova Pro) |
| `transcribe_audio` | S3 URI | テキスト | Amazon Transcribe |
| `integrate_results` | 動画分析結果, 文字起こしテキスト | 統合観察結果 JSON | ローカル処理 |
| `match_existing_tics` | 統合結果, 既存チックカード一覧 | best_match + confidence | Bedrock (Claude Haiku) |
| `apply_guardrails` | 最終出力テキスト | フィルタ済みテキスト | Bedrock Guardrails |
| `store_label` | episodeId, ラベルデータ | 保存結果 | DynamoDB |

### Agent 実行フロー

```
1. analyze_video → Nova Pro で動画分析
2. transcribe_audio → Transcribe で音声文字起こし
3. integrate_results → 動画分析 + 音声結果統合
4. match_existing_tics → Claude Haiku で既出チック照合
5. apply_guardrails → Guardrails でフィルタ
6. store_label → DynamoDB に保存
```

---

## backend.ts 変更

Step 4 到達時、`backend.ts` の以下のコメントを解除:

```typescript
// import { aiProxy } from './functions/ai-proxy/resource';
// defineBackend に aiProxy 追加
// const aiStack = backend.createStack('ai-stack');
// const ai = new AiConstruct(aiStack, 'Ai', { ... });
// ai-proxy Lambda の環境変数 + IAM grants
```

---

## Guardrails 設定

> 参照: `architecture_final.md` §8.7

| カテゴリ | ブロック対象 | 例 |
|---------|-------------|-----|
| 診断 | 疾患名の断定 | 「トゥレット症候群です」→ ブロック |
| 治療助言 | 投薬推奨 | 「薬物療法を検討すべき」→ ブロック |
| 因果断定 | 原因の特定 | 「ストレスが原因です」→ ブロック |
| 予後予測 | 将来予測 | 「悪化するでしょう」→ ブロック |

**許可する表現**: 「〜のように観察されます」「〜の可能性があります」「医療専門家にご相談ください」

---

## フィードバック記録

> 参照: `architecture_final.md` §8.6

Episodes テーブルの追加フィールド:

| フィールド | 内容 |
|-----------|------|
| `originalAILabel` | AI 提案ラベル `{type, severity, context, matchedTicCardId, matchConfidence}` |
| `feedbackType` | `confirmed_as_is` / `edited_type` / `edited_severity` / `edited_context` / `edited_match` / `rejected` |
| `feedbackDetails` | `{changedFields: [...], originalValues: {...}, newValues: {...}}` |
| `confirmedLabel` | 確定ラベル `{type, severity, context, ticCardId}` |

---

## AgentCore デプロイ手順

> 参照: `architecture_final.md` §8.5

```bash
# 1. Docker イメージビルド（ARM64）
cd agents
docker buildx build --platform linux/arm64 -t tictrack-agents .

# 2. ECR にプッシュ
aws ecr get-login-password | docker login --username AWS --password-stdin <ECR_URI>
docker tag tictrack-agents:latest <ECR_URI>:latest
docker push <ECR_URI>:latest

# 3. AgentCore CLI でデプロイ
# (AgentCore CLI のコマンドはドキュメント参照)
```

---

## 作業内容

### 1. Strands Agent 実装

- 6 つの @tool 関数を実装
- FastAPI `/invocations` + `/ping` エンドポイント
- pytest + moto でユニットテスト

### 2. Docker ビルド + ECR + AgentCore

- ARM64 コンテナビルド
- ECR プッシュ
- AgentCore Runtime デプロイ

### 3. Lambda Proxy 実装

- `ai-proxy/handler.ts`: AgentCore の `/invocations` を HTTP 呼び出し
- エラーハンドリング（AgentCore 不通時のフォールバック）

### 4. AiConstruct (CDK)

- `amplify/custom/ai/index.ts`: Bedrock Guardrails + AgentCore IAM ロール
- `backend.ts` 更新

### 5. フロントエンド

- エピソード詳細画面: AI ラベル表示（type, severity, context）
- 確認/修正 UI（そのまま確認 / type変更 / severity変更 / context変更 / 却下）
- 「AI は大きな動きの検出が得意です」ガイダンス表示

---

## TDD テスト項目

- [ ] Agent が `analyze_video` ツールを呼び出し、構造化 JSON（`observations` 配列含む）を返すこと
- [ ] Agent が `transcribe_audio` ツールを呼び出し、テキストを返すこと
- [ ] Nova Pro 出力の `type` が `motor` / `vocal` / `both` のいずれかであること
- [ ] Nova Pro 出力の `severity` が 1〜3 の整数であること
- [ ] Transcribe ジョブが完了し、テキスト出力が取得できること（音声付き動画）
- [ ] 音声なし動画の場合に `transcribe_audio` ツールが空文字を返すこと
- [ ] Guardrails ツールが「トゥレット症候群です」のような診断表現をブロックすること
- [ ] Guardrails ツールが「薬物療法を検討すべき」のような治療助言をブロックすること
- [ ] Guardrails ツールが「〜のように観察されます」という表現を許可すること
- [ ] Agent 全ツール実行後に AILabels テーブルに `episodeId` + `version=1` で保存されること
- [ ] AI ラベルが Episodes テーブルの `originalAILabel` に保存されること
- [ ] Episodes の `labelStatus` が AI 分析完了後に `ai_suggested` に更新されること
- [ ] 親が「そのまま確認」した場合に `feedbackType` が `confirmed_as_is` になること
- [ ] 親が severity を修正した場合に `feedbackType` が `edited_severity`、`feedbackDetails.changedFields` に `["severity"]` が記録されること
- [ ] 親が却下した場合に `feedbackType` が `rejected` になること
- [ ] Lambda Proxy → AgentCore の HTTP 呼び出しが成功すること
- [ ] AgentCore の /ping エンドポイントが 200 を返すこと
- [ ] Agent ツール内でエラー発生時に DDB ステータスが `failed` に更新されること

---

## リスク & フォールバック

> 参照: `architecture_final.md` §8.1, `implementation_roadmap.md` リスク管理

| リスク | 対策 |
|--------|------|
| Nova Pro 精度不十分 | Step 4 序盤で PoC（3-5 本テスト動画）。不足なら Claude Sonnet に切替 |
| AgentCore 不安定 | Level 1: Lambda Python に移行 |
| Strands SDK 問題 | Level 2: Raw Bedrock API |
| Python 全体問題 | Level 3: Step Functions + Node.js に回帰 |

---

## 完了基準

- 動画アップロード → AI が「運動チック、重さ 2、就寝前」と提案 → 親が確認 → ラベル確定 → フィードバック記録
- **最低限デモ (Minimum Demo)** のデモシナリオが動作する
- 全 TDD テスト項目が Green

---

## リスクチェックポイント

> **Day 13 時点**: Step 4 が完了していなければ Step 5 を簡略化/スキップ

---

## 次のステップ

→ [Step 5: 既出チック照合](../step5/README.md)
