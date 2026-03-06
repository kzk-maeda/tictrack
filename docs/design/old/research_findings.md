# TicTrack 技術調査結果

> **ステータス**: 調査完了
> **調査日**: 2026-02-12
> **調査範囲**: architecture_draft_v1.md および technical_uncertainties.md に記載された全技術的不確実性
> **調査方法**: AWS 公式ドキュメント、公式ブログ、技術記事、コミュニティ情報の Web 調査

---

## P1: ブロッキング課題の調査結果

### 1. Bedrock コスト とコンペルール

**結論**: **Bedrock の使用は許可されている。コストは $200 の Free Tier クレジットで十分カバー可能**

**調査内容**:

#### コンペルールの確認
- コンペの公式ルールでは「Stay within AWS Free Tier limits」が要件
- ただし、コンペは「AWS AI services」の活用を明示的に推奨しており、Bedrock は主要推薦サービス
- AWS Builder Center に **「Using Amazon Bedrock with AWS Free Tier for the 10,000 AIdeas Competition」** という公式ガイド記事が存在（[出典](https://builder.aws.com/content/37sJKL0vWEJnXGcAfAzCknNY6tR/using-amazon-bedrock-with-aws-free-tier-for-the-10000-aideas-competition)）
- → **Bedrock の使用はコンペで明示的に想定されている**

#### AWS Free Tier クレジット
- 2025年7月より、新規 AWS アカウントには **最大 $200 の Free Tier クレジット** が提供される（[出典](https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/)）
  - サインアップ時: $100
  - アクティビティ完了時（Bedrock Playground 利用含む）: 追加 $100
  - 有効期間: 6 ヶ月（有料プランにアップグレードすれば最大 12 ヶ月）
- AgentCore にも **$200 の Free Tier クレジット** が別途あり（[出典](https://aws.amazon.com/bedrock/agentcore/pricing/)）

#### Nova Pro の料金
- **入力トークン**: $0.0008 / 1,000 トークン
- **出力トークン**: $0.0032 / 1,000 トークン
- 出典: [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/), [Amazon Nova Pricing](https://aws.amazon.com/nova/pricing/)

#### 動画分析コスト試算（10〜20 秒の動画）
- 10 秒動画 = 10 フレーム = **約 2,880 入力トークン**
- 20 秒動画 = 20 フレーム = **約 5,760 入力トークン**
- 出力: 約 500 トークン（構造化 JSON）と仮定

| 項目 | 計算 | コスト |
|------|------|--------|
| 10 秒動画 1 本の入力 | 2,880 tokens × $0.0008/1K | $0.0023 |
| 20 秒動画 1 本の入力 | 5,760 tokens × $0.0008/1K | $0.0046 |
| 出力 (500 tokens) | 500 tokens × $0.0032/1K | $0.0016 |
| **10 秒動画 1 本合計** | | **~$0.004** |
| **20 秒動画 1 本合計** | | **~$0.006** |
| **100 本/月 (10秒)** | | **~$0.40** |
| **500 本/月 (20秒)** | | **~$3.10** |

- プロトタイプ想定（月100動画）: **約 $0.40/月**（当初想定の $5-8 より大幅に安い）
- Claude Haiku テキスト生成 200 リクエスト/月: 約 $1-2
- Titan Embeddings + KB: 約 $0.5-1
- Guardrails: 約 $1-2
- **月額合計: 約 $3-6**（当初想定の $10-15 より安い）

**推奨**:
1. **Bedrock は問題なく使用可能** — コンペが公式に想定しているサービス
2. $200 の Free Tier クレジットで **2〜3 ヶ月以上** のプロトタイプ運用が可能
3. コスト最適化: プロンプトキャッシュ（最大 90% 削減）、バッチ処理の活用を検討
4. アーキテクチャ設計書のコスト見積もりを **$3-6/月** に下方修正すべき

**アーキテクチャへの影響**: 低い（ポジティブ）。コスト面の懸念は解消。

---

### 2. Nova Pro 動画分析能力

**結論**: **Nova Pro は動画の直接分析に対応しており、チック検出の PoC は技術的に実行可能**

**調査内容**:

#### 基本仕様
- **入力形式**: MP4, MOV, MKV, WebM, FLV, MPEG, MPG, WMV, 3GP
- **入力方法**: Base64（25MB以下）または **S3 URI（推奨、最大 1GB）**
- **最大動画長**: 30 分（300K トークンコンテキスト）
- **フレームサンプリング**: 16 分以下は **1 FPS**、16 分超は動的サンプリング（最大 960 フレーム維持）
- **解像度**: 全て 672×672 にリサイズされる（4K と Full HD で精度差なし）
- **ペイロード制限**: 1 リクエストに 1 動画のみ
- 出典: [Amazon Nova Video Understanding](https://docs.aws.amazon.com/nova/latest/userguide/modalities-video.html)

#### トークン数の目安

| 動画長 | フレーム数 | サンプリング | トークン数 |
|--------|-----------|------------|-----------|
| **10 秒** | 10 | 1 FPS | **2,880** |
| **20 秒** | 20 | 1 FPS | **5,760** |
| 30 秒 | 30 | 1 FPS | 8,640 |
| 16 分 | 960 | 1 FPS | 276,480 |

#### チック検出への適合性評価
- **強み**:
  - 1 FPS のサンプリングはチック検出に十分（チックは通常 0.5〜1 秒持続）
  - 構造化 JSON 出力の指示に対応（分類、タイムスタンプ、信頼度スコア）
  - S3 URI 入力により Lambda からの統合が容易
  - 動画の質問応答、分類、要約に対応
  - 出典: [Amazon Nova Understanding Models](https://aws.amazon.com/ai/generative-ai/nova/understanding/)
- **懸念点**:
  - 672×672 へのリサイズにより、細かい運動チック（瞬き等）の検出精度に影響の可能性
  - チック検出に特化した事前評価は見当たらない
  - 医療/行動分析領域での公開ベンチマークなし
- **活用事例**: AWS re:Post に歴史的フィルム（初の実写映画）の動画理解の事例あり（[出典](https://repost.aws/articles/AR_gOofqdCSbKxZ1e-Eve7Ng/applying-amazon-nova-pro-model-video-understanding-capabilities-to-first-real-motion-picture-ever-made)）

#### Nova 2 の存在
- 2025年12月に **Amazon Nova 2** ファウンデーションモデルが発表（[出典](https://aws.amazon.com/about-aws/whats-new/2025/12/nova-2-foundation-models-amazon-bedrock/)）
- Nova 2 Lite には 1 FPS を最大 3,200 フレームまで維持する改良あり
- プロトタイプ開始時点で Nova 2 の利用も検討可能

**推奨**:
1. **早期 PoC を最優先で実施**（Week 1）
2. 10〜20 秒のサンプル動画（首振り、瞬き、咳払い等のシミュレーション）で検証
3. 720p 程度の動画で十分（672×672 にリサイズされるため、それ以上は不要）
4. プロンプトに「チックの典型パターン」の詳細記述を含めるプロンプトエンジニアリングが重要
5. **フォールバック戦略**: 精度不十分な場合 → 「疑わしい動きの検出」のみ + 親が分類

**アーキテクチャへの影響**: 中程度。基本設計は維持可能だが、PoC 結果次第でフォールバック戦略の追加が必要。

---

### 3. AgentCore vs Step Functions

**結論**: **プロトタイプでは Step Functions メインを推奨。AgentCore はオプション拡張として検討**

**調査内容**:

#### AgentCore の現状
- **GA 日**: 2025年10月13日に一般提供開始（[出典](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available/)）
- **課金モデル**: 消費ベース（秒単位の vCPU / メモリ課金 + Gateway 操作課金）、最小課金は 128MB メモリ × 1 秒
- **主要機能**: Runtime、Gateway（MCP サーバー）、Memory、Identity、Observability、Policy（プレビュー）、Browser、Code Interpreter
- **Free Tier**: 新規 AWS ユーザーに **$200 の Free Tier クレジット**
- **セッション**: 最大 8 時間の長時間実行ワークフローに対応
- 出典: [AgentCore Pricing](https://aws.amazon.com/bedrock/agentcore/pricing/), [AgentCore Overview](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)

#### 比較分析（AWS 公式ガイダンスに基づく）

| 観点 | Step Functions | AgentCore/Bedrock Agents |
|------|---------------|-------------------------|
| **最適用途** | 制御された決定論的プロセス | 自然言語インタラクション、柔軟なゴール達成 |
| **ロジック定義** | 明示的に定義されたワークフロー | LLM 駆動の動的推論 |
| **入力処理** | 構造化された所定のパス | 非構造化、適応的解釈 |
| **監査性** | ◎ 完全な状態トレース | △ ログで補完可能 |
| **レイテンシ** | ◎ リアルタイム | △ LLM 推論分やや遅い |
| **開発難易度** | ◎ 成熟、豊富な事例 | △ 新サービス、学習コスト |

出典: [AWS Prescriptive Guidance - Orchestration Models](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-serverless/orchestration-models.html)

#### AWS 公式推奨パターン
AWS は **ハイブリッドアプローチ** を推奨:
- **Step Functions**: 決定論的ビジネスロジック（支払い、在庫、コンプライアンス）
- **Bedrock Agents**: 対話型、適応型ロジック（顧客意図、サポート、推薦）
- **EventBridge**: リアクティブなスケーラビリティとモジュラー進化

#### TicTrack への適用

| 用途 | 推奨 | 理由 |
|------|------|------|
| AI ラベリング | **Step Functions + Bedrock API 直接呼び出し** | ワークフローは固定的（動画→分析→照合→保存）、AgentCore は過剰 |
| 週次レポート | **Step Functions** | 定型的なバッチワークフロー |
| マイクロガイド | **Knowledge Bases 直接呼び出し** | 単発 RAG クエリ |
| （将来拡張）対話型サポート | AgentCore / Bedrock Agents | 動的なユーザー対話に適合 |

**推奨**:
1. **MVP では Step Functions + Bedrock API 直接呼び出しを採用** — 29 日間で確実に動作するものを優先
2. AI ラベリングは Step Functions で `Lambda(Nova Pro 呼び出し) → Lambda(照合) → Lambda(Guardrails + 保存)` のシンプルなパイプライン
3. AgentCore はコンペでのアピールポイントとして **将来拡張の候補** として設計書に記載
4. コンペ審査対策: Bedrock の複数サービス（Nova Pro, Claude, Knowledge Bases, Guardrails）を効果的に活用していれば、AgentCore なしでも十分な評価を得られる

**アーキテクチャへの影響**: 高い。**設計書の AgentCore 部分を Step Functions + Lambda に変更すべき**。コンポーネント図とワークフロー図の修正が必要。

> **注記（2026-03-06）**: 上記の §3 の結論（Step Functions メインを推奨）は、2026-02-12 時点の判断として妥当であった。しかし、プロジェクトの方針変更により、以下の §3b で Strands Agents SDK + AgentCore Runtime の再評価と採用決定を記載する。

---

### 3b. AgentCore + Strands Agents SDK 再評価（2026-03-06 更新）

**結論**: **Strands Agents SDK + AgentCore Runtime を採用する。AI ラベリングとマイクロガイドを Agent ベースで実装。**

#### Strands Agents SDK の概要

- **OSS（オープンソース）** の AI Agent フレームワーク（Apache 2.0 ライセンス）
- **Python ファースト**: `@tool` デコレータでツールを定義、`strands.Agent` クラスでエージェントを構成
- **マルチモデル対応**: Amazon Bedrock（Nova Pro、Claude 等）を含む複数の LLM プロバイダーに対応
- **シンプルな API**: Agent 定義は数十行、ツール定義は Python 関数 + デコレータのみ
- ドキュメント・サンプルが充実しており、学習コストは当初想定より低い

#### AgentCore Runtime の進化

- **GA から約 5 ヶ月経過**（2025年10月 GA → 2026年3月時点）: 安定性が向上
- **$200 の Free Tier クレジット**: プロトタイプ運用に十分
- **コンテナベースデプロイ**: Docker + ECR → AgentCore Runtime にデプロイ。FastAPI で `/invocations` エンドポイントを提供
- **課金モデル**: vCPU-hour ベース（$0.0895/vCPU-hour、ARM64）。プロトタイプの想定使用量では月 ~$0.03

#### 採用判断の変更理由

| # | 理由 | 詳細 |
|---|------|------|
| 1 | **技術学習の価値** | コンペの目的は AWS AI サービスの活用。最新の Agent 技術（Strands + AgentCore）を学習・実装することは審査でのアピールポイント |
| 2 | **アーキテクチャ簡素化** | Step Functions + 5 Lambda（Node.js）→ Strands Agent 1 つ + 6 ツール（Python）。ワークフロー定義が不要になり、Agent が自律的にツールを選択・実行 |
| 3 | **フォールバック容易性** | Strands Agent は標準 Python コード。AgentCore が不安定な場合 → Lambda (Python) にそのまま移行可能（FastAPI → Lambda handler への変更のみ）。Strands SDK 自体に問題がある場合 → Raw Bedrock API を Python から直接呼び出し |
| 4 | **デュアル Agent 活用** | Tic Labeling Agent + Micro-Guide Agent の 2 つを AgentCore にデプロイ。マイクロガイドも Agent 化することで一貫したアーキテクチャに |

#### 新しい AI パイプライン設計

**Before（§3 の推奨設計）**: Step Functions + 5 Lambda（Node.js）
```
POST /analyze → Step Functions 起動
  → Parallel: Lambda(Nova Pro) + Lambda(Transcribe)
  → Lambda(IntegrateResults)
  → Lambda(TicCardMatching via Claude)
  → Lambda(Guardrails)
  → Lambda(SaveResults to DDB)
```

**After（新設計）**: Strands Agent + AgentCore
```
POST /analyze → Lambda Proxy → AgentCore (Tic Labeling Agent)
  → Agent が自律的にツールを選択・実行:
    @tool analyze_video (Nova Pro)
    @tool transcribe_audio (Transcribe)
    @tool integrate_results
    @tool match_existing_tics (Claude Haiku)
    @tool apply_guardrails (Bedrock Guardrails)
    @tool store_label (DynamoDB)
```

#### フォールバック戦略

| Level | 条件 | 対策 |
|-------|------|------|
| Level 1 | AgentCore Runtime が不安定 | Lambda (Python) に Agent コードをそのまま移行 |
| Level 2 | Strands SDK に問題 | Raw Bedrock API を Python Lambda から直接呼び出し |
| Level 3 | Python 全体が問題 | 既存設計の Step Functions + Node.js Lambda に回帰（§3 の設計） |

**アーキテクチャへの影響**: 高い。§3 の結論を覆し、**Strands Agents SDK + AgentCore Runtime を採用**。`architecture_final.md` の ADR-1、§8 AI/ML パイプライン、§9.3 マイクロガイドを全面更新。

---

## P2: 重要課題の調査結果

### 4. モバイル Web 動画キャプチャ UX

**結論**: **MediaRecorder API は iOS Safari 14.5+ で対応済み。ハイブリッドアプローチで安全に実装可能**

**調査内容**:

#### ブラウザ互換性
| ブラウザ | MediaRecorder 対応 | 備考 |
|----------|-------------------|------|
| **Safari iOS 14.5+** | ✅ 完全対応 | iOS 14.5 以降は標準で有効 |
| Safari iOS 12-14.4 | ❌（実験的） | 設定 > Safari > 実験的機能 で有効化が必要 |
| Chrome Android | ✅ 完全対応 | 古いバージョンから対応 |
| Chrome Desktop | ✅ 完全対応 | — |

出典: [Can I Use - MediaRecorder](https://caniuse.com/mediarecorder), [WebKit Blog - MediaRecorder API](https://webkit.org/blog/11353/mediarecorder-api/)

#### フォーマット差異
| ブラウザ | 出力形式 |
|----------|---------|
| Chrome/Android | `video/webm` (VP8/VP9) |
| Safari/iOS | `video/mp4` (H.264) |

- Nova Pro は **MP4, WebM 両方に対応**しているため、フォーマット変換は不要
- `MediaRecorder.isTypeSupported()` で各デバイスの対応形式を検出すべき

#### PWA カメラアクセス
- HTTPS 必須（Amplify Hosting はデフォルトで HTTPS）
- iOS PWA のカメラアクセスは対応済み（[出典](https://firt.dev/notes/pwa-ios/)）
- ホーム画面追加後の PWA からもカメラアクセス可能

#### フォールバック戦略
- `<input type="file" accept="video/*" capture="environment">` でネイティブカメラアプリを起動
- MediaRecorder 非対応環境（iOS 14.4 以前）用のフォールバック

**推奨**:
1. **MediaRecorder API をメインに採用**（iOS 14.5+ はシェア率高い）
2. `MediaRecorder.isTypeSupported()` で形式を検出し、MIME タイプを動的に設定
3. `<input capture>` をフォールバックとして実装
4. `videoBitsPerSecond` パラメータで録画品質を制御（720p、1.5Mbps 程度で十分）
5. 実機テスト（iPhone + Android）を Week 1-2 で実施

**アーキテクチャへの影響**: 低い。設計通りに実装可能。フォールバック実装の工数を見込むこと。

---

### 5. Missing-Data Tolerant な統計手法

**結論**: **MVP では記述統計 + 最低観測閾値 + データ品質ラベルのシンプルなアプローチで十分**

**調査内容**:

#### 学術的背景
- 時系列データの欠測処理は広く研究されている分野
- 主要手法: LOCF（Last Observation Carried Forward）、ARIMA + カルマンスムージング、多重代入法
- ただし、これらは「欠測を補完して分析する」アプローチであり、TicTrack の要件とは異なる
- TicTrack は **「欠測がある前提で誤解を招かない表示をする」** ことが目的
- 出典: [BMC Medical Research Methodology](https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/s12874-024-02448-3)

#### MVP に最適なアプローチ（推奨）

**1. 記述統計に限定**
- 「記録された範囲では〜」という前提を常に明示
- 補完・推定は行わない（プロトタイプでは不要、誤解のリスクを排除）

**2. 最低観測閾値**
| 記録日数 | 表示内容 |
|----------|---------|
| 0 日 | 「今週の記録はありません」 |
| 1-2 日 | 基本カウントのみ（「X 回の記録」）、傾向分析なし |
| **3 日以上** | 傾向分析を含むフルレポート |

**3. データ品質ラベル**
- 各統計にデータの信頼性を示すラベルを付与
  - 「十分なデータ」（5+ 日）: グリーン
  - 「参考データ」（3-4 日）: イエロー
  - 「データ不足」（1-2 日）: グレー

**4. 正規化手法**
- 前週比は「1 記録日あたりの平均エピソード数」で正規化
- 記録のない時間帯はグレーアウト表示

**5. 免責注記**
```
「このレポートは、今週記録された観察のみに基づいています。
 記録されていない時間帯にも症状が発生している可能性があります。
 傾向の解釈は、医療専門家とご相談ください。」
```

**推奨**:
1. **MVP は上記のシンプルなアプローチで十分** — 複雑な統計手法は不要
2. 高度な欠測補完（ARIMA、多重代入等）は将来の拡張として位置づけ
3. 重要なのは「何を表示するか」ではなく「何を表示しないか」
4. 統計表示のモックアップを早めに作成し、直感的に理解できるか検証

**アーキテクチャへの影響**: 低い。設計書の統計アプローチは妥当。実装はシンプルな JavaScript で完結。

---

### 6. Lambda PDF 生成

**結論**: **pdfkit が Lambda に最適。軽量で Native 依存なし、十分な機能を提供**

**調査内容**:

#### ライブラリ比較

| ライブラリ | パッケージサイズ | Native 依存 | Lambda 適性 | 特徴 |
|-----------|---------------|------------|------------|------|
| **pdfkit** | **< 5 MB** | **なし** | **◎** | プログラマティック、純粋 JS |
| pdfmake | ~10 MB | なし | ◎ | 宣言的定義、テーブル対応 |
| @react-pdf/renderer | ~15 MB | なし | ○ | React コンポーネント、慣れた DX |
| Puppeteer + chrome-aws-lambda | **~50 MB** | **あり** | △ | HTML→PDF、最高品質だが重い |

出典: [Serverless PDFs with Lambda & PDFKit](https://jamesthom.as/2021/01/generating-serverless-pdfs-with-aws-lambda-pdfkit/), [Austin Gil - PDF Generation](https://austingil.com/generating-pdfs-node-pdfkit-serverless-aws-lambda/)

#### pdfkit の利点
- **純粋 JavaScript** — ネイティブライブラリのコンパイルや外部依存が不要
- **パッケージサイズ < 5 MB** — Lambda デプロイが軽量
- **ストリーム対応** — メモリ効率が良い（Lambda の /tmp 512MB 制限にも対応）
- **プログラマティック API** — テキスト、テーブル、画像の埋め込みが容易

#### チャートの埋め込み
- **chartjs-node-canvas** または **chart.js + Canvas ライブラリ** で画像生成
- 生成した PNG を pdfkit に埋め込み
- 代替: SVG → PNG 変換 → PDF 埋め込み
- シンプルな棒グラフ・円グラフなら pdfkit のネイティブ描画機能でも可能

#### Lambda 設定の注意点
- API Gateway のバイナリメディアタイプ設定が必要（`application/pdf`）
- レスポンスを Base64 エンコードするか、S3 に保存して Presigned URL を返す方式が推奨
- コールドスタート: pdfkit は軽量なので影響は最小

**推奨**:
1. **pdfkit を採用** — 最も軽量で Lambda に最適
2. チャートは **chartjs-node-canvas** で PNG 画像生成 → PDF に埋め込み
3. PDF は S3 に直接保存し、Presigned URL で配信（API Gateway のバイナリ設定を回避）
4. Lambda レイヤーは不要（パッケージサイズが十分小さい）

**アーキテクチャへの影響**: 低い。設計書の PDF 生成部分は妥当。具体的なライブラリ選定を pdfkit に確定。

---

### 7. Amplify Gen 2 + Next.js PWA

**結論**: **Amplify Gen 2 は Next.js を強力にサポート。PWA は Serwist（next-pwa 後継）を採用すべき**

**調査内容**:

#### Amplify Gen 2 の Next.js サポート
- **Next.js 15 まで対応**（App Router、Pages Router 両対応）
- SSR（Server-Side Rendering）、ISR（Incremental Static Regeneration）対応
- 画像最適化、ミドルウェア対応
- **Node.js 20 / 22 ランタイム** をサポート（Node.js 18 以前は 2025/9/15 にサポート終了）
- TypeScript ベースのコードファースト DX（`amplify/backend.ts` でバックエンド定義）
- Cognito、S3 との自動統合
- 出典: [Amplify Next.js Support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html), [Amplify Gen 2 Docs](https://docs.amplify.aws/nextjs/)

#### Gen 1 vs Gen 2
- Gen 1 と Gen 2 は **異なるアーキテクチャパラダイム**（同一プロジェクトでの併用不可）
- Gen 1 から Gen 2 への **移行ツールは開発中**
- AWS は Gen 1 を **「当面の間」サポート継続**（高優先バグ修正とセキュリティアップデート）
- **新規プロジェクトは Gen 2 を使用すべき**
- ※ Gen 1 の明示的な EOL 日付は確認できなかった（当初想定の 2026/8 は未確認）
- 出典: [Amplify FAQ](https://docs.amplify.aws/react/how-amplify-works/faq/)

#### PWA 構成
- **next-pwa**: メンテナンス停滞 → **非推奨**
- **@ducanh2912/next-pwa**: next-pwa のフォーク → Serwist への移行を推奨
- **Serwist（@serwist/next）**: Google Workbox ベース、next-pwa の正式後継。**Next.js 公式ドキュメントでも推薦**
- Serwist は Service Worker の管理、オフラインキャッシュ、プリキャッシュを提供
- 出典: [Serwist Next.js Guide](https://serwist.pages.dev/docs/next/getting-started), [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

**推奨**:
1. **Amplify Gen 2 + Next.js 14/15 (App Router)** を採用（設計書通り）
2. PWA には **Serwist (@serwist/next)** を採用（next-pwa ではなく）
3. Node.js 20 ランタイムを使用
4. バックエンド定義は `amplify/backend.ts` で TypeScript コードファースト
5. Cognito + S3 統合は Amplify の自動統合を活用

**アーキテクチャへの影響**: 低い。設計書の `next-pwa` を **Serwist** に変更。それ以外は設計通り。

---

## P3: 参考情報の調査結果

### 8. Knowledge Bases S3 Vectors

**結論**: **S3 Vectors が最適。OpenSearch Serverless と比較して最大 90% コスト削減**

**調査内容**:

#### S3 Vectors の概要
- 2025年12月に **GA（一般提供）** — 14 リージョンで利用可能
- Amazon Bedrock Knowledge Bases と **ネイティブ統合**
- サブ秒のクエリパフォーマンスを維持しつつ、大幅なコスト削減を実現
- 出典: [S3 Vectors GA Announcement](https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-s3-vectors-generally-available/), [Building cost-effective RAG with S3 Vectors](https://aws.amazon.com/blogs/machine-learning/building-cost-effective-rag-applications-with-amazon-bedrock-knowledge-bases-and-amazon-s3-vectors/)

#### 料金体系

| 項目 | S3 Vectors | OpenSearch Serverless |
|------|-----------|---------------------|
| **ストレージ** | **$0.06/GB/月** | ~$0.24/hour（最低 ~$175/月） |
| **PUT** | $0.20/GB | OCU ベース課金 |
| **クエリ** | TB 単位の従量課金 | OCU ベース課金 |
| **最低コスト** | **ほぼ $0**（小規模） | **~$175/月** |

出典: [S3 Vectors Pricing](https://aws.amazon.com/s3/features/vectors/), [S3 Vectors Pricing Deep Dive](https://murraycole.com/posts/aws-s3-vectors-pricing-deep-dive)

#### TicTrack での試算
- マイクロガイド用ナレッジ: 数十〜数百のドキュメントチャンク
- ストレージ: 数 MB 程度 → **月額 $0.01 未満**
- クエリ: 月 50 回程度 → **月額 $0.01 未満**
- **実質無料に近い**

**推奨**: 設計書通り S3 Vectors を採用。コスト面で最適な選択。

**アーキテクチャへの影響**: なし。設計書通り。

---

### 9. Kiro IDE

**結論**: **Kiro は Spec-driven 開発に対応した AI IDE。Hooks は自動テスト・品質管理に活用可能**

**調査内容**:

#### Kiro の概要
- **VS Code ベース** の AI 搭載 IDE
- AWS が開発・提供
- プロンプトを明確な要件、構造化された設計、実装タスクに変換
- 出典: [Kiro 公式サイト](https://kiro.dev/), [Introducing Kiro](https://kiro.dev/blog/introducing-kiro/)

#### Spec-driven 開発ワークフロー
3 つのフェーズで構成:
1. **Requirements（要件定義）**: ユーザーストーリーと受け入れ条件の生成
2. **Design（設計）**: 技術設計ドキュメントの作成
3. **Implementation（実装）**: 依存関係に基づいた順序付きタスクの生成 + テスト

- Spec 生成: 中程度の複雑さで **30〜45 秒**
- Hook 実行: シンプルなタスクで **2〜5 秒**、複雑な分析で **2 分以上**
- 出典: [AWS Kiro - The New Stack](https://thenewstack.io/aws-kiro-testing-an-ai-ide-with-a-spec-driven-approach/)

#### Hooks の仕組み
- **設定ファイル**: `.kiro/hooks/` ディレクトリ配下の `*.kiro.hook` ファイル
- **イベントタイプ**:
  - ファイル保存時（File Save）
  - ファイル作成時（File Create）
  - ファイル削除時（File Delete）
  - ユーザープロンプト送信時
  - エージェントターン完了時
- **アクション**: エージェントプロンプト実行 or シェルコマンド実行
- 出典: [Kiro Hooks Documentation](https://kiro.dev/docs/hooks/), [Hook Types](https://kiro.dev/docs/hooks/types/)

#### Hooks の活用例（TicTrack 向け）
```
# テスト自動更新 Hook
Event: File Save
Pattern: src/**/*.ts
Action: ソースコードの変更を検出し、関連するテストファイルを自動更新

# API 型定義自動生成 Hook
Event: File Save
Pattern: specs/**/*.md
Action: Spec 変更を検出し、TypeScript 型定義を自動生成
```

**推奨**:
1. Kiro の Spec-driven ワークフローをフル活用（コンペ要件を満たす）
2. Hooks でテスト自動更新を設定（TDD ワークフローの効率化）
3. Requirements → Design → Implementation のフローでフィーチャーを開発
4. コンペ提出時に Kiro の活用方法を Builder Center 記事で詳述

**アーキテクチャへの影響**: なし。設計書の Kiro セクションは妥当。具体的な Hook 設定例を追加推奨。

---

### 10. DynamoDB マルチテーブル設計

**結論**: **プロトタイプではマルチテーブル設計が適切。AWS 公式もこの方針を支持**

**調査内容**:

#### AWS 公式ガイダンス
- AWS 公式ブログで **マルチテーブル vs シングルテーブル** の詳細比較を公開
- **新規アプリケーション（アクセスパターンが未確定）**: マルチテーブルが推奨
- **成熟したアプリケーション（パフォーマンス最適化が必要）**: シングルテーブルが推奨
- 出典: [AWS Blog - Single-table vs Multi-table](https://aws.amazon.com/blogs/database/single-table-vs-multi-table-design-in-amazon-dynamodb/)

#### マルチテーブルの利点（プロトタイプ向け）
- 開発者体験が直感的（各テーブルが 1 エンティティ）
- アクセスパターンの変更に柔軟に対応
- 可読性が高く、デバッグが容易
- MVP で迅速にイテレーションできる

#### TicTrack への適合性
- エンティティ間のアクセスパターンが比較的独立（ユーザー → 子ども → エピソード の階層構造）
- クロステーブル結合の頻度が低い
- 29 日間の開発期間でシングルテーブル設計の学習コストは不要
- Free Tier の 25 WCU/25 RCU はマルチテーブルでも十分

**推奨**: 設計書通りマルチテーブルを採用。プロトタイプ段階では最適な選択。

**アーキテクチャへの影響**: なし。設計書通り。

---

## 総合評価と推奨事項

### 全体的な実現可能性: ✅ 高い

アーキテクチャ設計書 v1 で提案された技術スタックは、Web 調査の結果、**概ね妥当** であることが確認された。

### 重要な変更推奨事項

| # | 変更点 | 優先度 | 理由 |
|---|--------|--------|------|
| 1 | **~~AgentCore → Step Functions + Bedrock API 直接呼び出し~~ → Strands Agents SDK + AgentCore Runtime 採用** | 🔴 高 | §3b で再評価・決定変更。技術学習の価値、アーキテクチャ簡素化、フォールバック容易性を考慮 |
| 2 | **コスト見積もり: $10-15/月 → $3-6/月** | 🟡 中 | 動画分析コストが当初想定より大幅に安い |
| 3 | **next-pwa → Serwist (@serwist/next)** | 🟡 中 | next-pwa はメンテナンス停滞、Serwist が Next.js 公式推薦 |
| 4 | **PDF ライブラリを pdfkit に確定** | 🟢 低 | Lambda に最適な選択を確定 |

### リスク残存項目

| # | リスク | 軽減策 | 期限 |
|---|--------|--------|------|
| 1 | Nova Pro のチック検出精度が不十分 | 早期 PoC + フォールバック戦略（親が分類） | Week 1 |
| 2 | iOS Safari の動画キャプチャ UX 問題 | 実機テスト + `<input capture>` フォールバック | Week 1-2 |
| 3 | $200 Free Tier クレジットの有効期限切れ | 早期にアカウント作成・アクティビティ完了 | 即時 |

### 即座に実行すべきアクション

1. **AWS アカウントで Free Tier クレジット $200 を確保**（サインアップ $100 + Bedrock Playground $100）
2. **Nova Pro PoC を Week 1 で実施**（5〜10 本のサンプル動画で検証）
3. **Amplify Gen 2 + Next.js + Serwist の初期セットアップ**（Week 1）
4. **設計書 v2 の作成**（AgentCore → Step Functions の変更、コスト見積もり修正）
