# Step 7: RAG マイクロガイド

> **日程**: Day 19-22
> **前提**: Step 6 完了（週次レポート）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §9 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)

---

## 目標

コンテキストに応じたガイド表示（Micro-Guide Agent + Knowledge Bases）。

---

## 前提条件

- Step 6 までの全機能が完了
- AgentCore Runtime が動作中（Step 4 で構築済み）
- S3 knowledge バケットが作成済み（`amplify/custom/foundation/index.ts`）

---

## 成果物

### Python Agent

| ファイル | 内容 |
|---------|------|
| `agents/micro_guide/agent.py` | Micro-Guide Agent 定義 + FastAPI エンドポイント |
| `agents/micro_guide/tools/retrieve_kb.py` | @tool: Knowledge Bases API 検索 |
| `agents/micro_guide/tools/format_guidance.py` | @tool: Claude Haiku 回答生成 |
| `agents/micro_guide/tools/apply_guardrails.py` | @tool: Guardrails フィルタ |
| `agents/tests/test_micro_guide/` | pytest テスト群 |

### ナレッジソース

| ファイル | 内容 |
|---------|------|
| `knowledge/micro-guides/supportive_communication.md` | 支援的コミュニケーション |
| `knowledge/micro-guides/environment_adjustment.md` | 家庭環境の調整 |
| `knowledge/micro-guides/medical_visit_checklist.md` | 受診準備チェックリスト |
| `knowledge/micro-guides/*.md` | その他 1-2 記事 |

### Amplify バックエンド

| ファイル | 内容 |
|---------|------|
| `amplify/custom/ai/index.ts` | AiConstruct に Knowledge Base 追加（`CREATE_KNOWLEDGE_BASE=true`） |

### Lambda API 追加

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/routes/guides.ts` | ガイド一覧 + RAG 質問応答 |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/guides/page.tsx` | マイクロガイド画面 |
| `src/components/guides/` | ガイド関連コンポーネント |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/guides?category=` | カテゴリ別ガイド一覧 |
| POST | `/guides/ask` | RAG ベースの質問応答 |

### リクエスト例

**POST `/guides/ask`**:
```json
{
  "question": "就寝前のチックが増えたのですが、何かできることはありますか？",
  "context": {
    "childId": "01HXYZ...",
    "recentPatterns": ["bedtime_increase"]
  }
}
```

**レスポンス**:
```json
{
  "answer": "就寝前のチック増加は...",
  "sources": [
    {
      "title": "家庭環境の調整",
      "chunk": "..."
    }
  ],
  "disclaimer": "詳しくは医療専門家にご相談ください。"
}
```

---

## Knowledge Bases 設定

> 参照: `architecture_final.md` §9.2

| 項目 | 設定 |
|------|------|
| データソース | S3 `tictrack-knowledge-{env}/micro-guides/` |
| ベクトルストア | S3 Vectors |
| 埋め込みモデル | Amazon Titan Embeddings V2 |
| チャンキング | Fixed-size（512 tokens, 20% overlap） |
| 検索パラメータ | Top-K=3, Score threshold=0.7 |

---

## Micro-Guide Agent

> 参照: `architecture_final.md` §9.3

### @tool 仕様

| ツール | 入力 | 出力 | 使用サービス |
|--------|------|------|-------------|
| `retrieve_knowledge_base` | 質問テキスト | 関連チャンク (Top-K=3) | Bedrock Knowledge Bases |
| `format_guidance` | 検索結果 + 質問 | フォーマット済み回答 | Bedrock (Claude Haiku) |
| `apply_guardrails` | 回答テキスト | フィルタ済みテキスト | Bedrock Guardrails |

### Agent 実行フロー

```
1. retrieve_knowledge_base → Knowledge Bases API で関連チャンクを検索
2. format_guidance → Claude Haiku で検索結果 + 質問から回答生成
3. apply_guardrails → Guardrails でフィルタ（Contextual Grounding）
4. ソース情報付きで返却
```

### Guardrails（マイクロガイド固有）

- Contextual Grounding: 回答がソースに基づいているかチェック
- ハルシネーション防止
- 常に「受診相談を促す」トーン

---

## 作業内容

### 1. ナレッジソースのキュレーション

- 信頼できる医療機関・公的機関の資料から 3〜5 記事を選定
  - 支援的コミュニケーション
  - 家庭環境の調整
  - 受診準備チェックリスト
- Markdown 形式で `knowledge/micro-guides/` に配置
- S3 knowledge バケットにアップロード

### 2. Knowledge Bases セットアップ

- `amplify/custom/ai/index.ts` で `CREATE_KNOWLEDGE_BASE=true` 時に作成
  - Bedrock Knowledge Base
  - S3 DataSource
  - IAM ロール
  - S3 Vectors ベクトルストア
- データ同期実行

### 3. Micro-Guide Agent 実装

- 3 つの @tool 関数を実装
- AgentCore に 2 つ目の Agent としてデプロイ（同一コンテナ内、別エンドポイント or ルーティング）
- Docker イメージ更新 + ECR プッシュ + AgentCore 再デプロイ

### 4. Lambda API 実装

- `routes/guides.ts`: カテゴリ別一覧 + RAG 質問応答
- Lambda Proxy → AgentCore Micro-Guide Agent

### 5. フロントエンド

- `/guides` ページ: カテゴリ別ガイド一覧 + 質問入力 + 回答表示
- ソース（引用元）表示

---

## backend.ts 変更

Step 7 到達時、AiConstruct で Knowledge Base を有効化:

```typescript
// CREATE_KNOWLEDGE_BASE=true で AiConstruct 内有効化
```

---

## TDD テスト項目

- [ ] Knowledge Bases にドキュメントを同期後、`retrieve_knowledge_base` ツールが関連チャンクを返すこと
- [ ] 「就寝前のチック」で検索して「家庭環境の調整」関連のチャンクがヒットすること
- [ ] 検索結果の `score` が 0.7 以上のチャンクのみが返されること
- [ ] `format_guidance` ツールが検索結果に基づいた回答を生成すること（ソースに含まれない情報を含まないこと）
- [ ] `apply_guardrails` ツールが「この薬を試してください」のような治療助言をブロックすること
- [ ] `apply_guardrails` ツールが「詳しくは医療専門家にご相談ください」を含む回答を許可すること
- [ ] 回答に出典リンク（ソースドキュメント名）が含まれること
- [ ] 該当するガイドが見つからない場合に「該当するガイドが見つかりませんでした。医療専門家にご相談ください。」が返されること
- [ ] カテゴリ別一覧 API が正しいカテゴリでフィルタされた結果を返すこと
- [ ] Micro-Guide Agent が AgentCore 上で /ping に 200 を返すこと

---

## リスク & フォールバック

| リスク | 対策 |
|--------|------|
| S3 Vectors が安定しない | ハードコードしたガイド一覧 + Claude による回答生成で代替 |
| Knowledge Bases セットアップが遅延 | 直接 Claude Haiku にガイド記事をプロンプトに含めて回答生成 |

---

## リスクチェックポイント

> **Day 22 時点**: Step 7 が完了していなければ Step 8 の簡略化判断

---

## 完了基準

- 「就寝前のチックが増えた」→ 関連ガイド表示 → 出典リンク付き
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 8: ポリッシュ + デモ準備](../step8/README.md)
