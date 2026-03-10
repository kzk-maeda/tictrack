# ADR 001: Strands Agents SDK + AgentCore Runtime の採用

## ステータス

承認済み（2026-03-06）

## 背景

AI ラベリング機能とマイクロガイド機能を実装するにあたり、以下の選択肢を検討した：

### 選択肢 1: Step Functions + Node.js Lambda
- AWS Step Functions で AI 処理を orchestrate
- Node.js Lambda から Bedrock API を直接呼び出し
- Prompt は Lambda 内にハードコード

### 選択肢 2: Strands Agents SDK + AgentCore Runtime
- Python でエージェントを定義（型安全、テスト可能）
- AgentCore Runtime で実行（Bedrock マネージドサービス）
- Tool 定義、プロンプト、モデル設定を Python コードで管理

### 問題点
- プロトタイプ開発で複数の AI Agent を実装する必要がある
- Prompt の調整が頻繁に発生する
- テストと反復が重要
- 本番環境でも使える堅牢性が必要

## 決定

**Strands Agents SDK + AgentCore Runtime を採用する。**

理由：
1. **開発速度**: Python での Agent 定義は直感的で、プロンプト調整が容易
2. **型安全性**: Strands SDK は型ヒントを提供し、開発時エラーを削減
3. **テスタビリティ**: ローカルで Agent をテスト可能（`scripts/test-agent-local.py`）
4. **マネージドサービス**: AgentCore Runtime は AWS が管理、スケーラビリティ確保
5. **コスト効率**: 実行時間課金、無料利用枠あり（$200×2）
6. **将来性**: Bedrock の公式 Agent フレームワークとして成熟

## 結果

### ポジティブ
- ✅ エージェント開発速度が向上（Step 4 を 3 日で実装）
- ✅ プロンプト調整の反復が高速（Python ファイル編集 → デプロイ）
- ✅ ローカルテストで品質向上
- ✅ Tool 定義がコードで管理され、変更追跡可能
- ✅ 週次レポート生成（Step 6）でも同じパターンを再利用可能

### ネガティブ
- ❌ Python と Node.js の 2 言語併用（学習コスト）
- ❌ AgentCore Runtime の制約（リージョン制限、ベータ機能）
- ❌ デバッグが CloudWatch Logs 経由で若干煩雑

### トレードオフ
- **複雑性の増加** vs **開発速度の向上** → 開発速度を優先
- **2 言語併用** vs **単一言語** → AI Agent の品質を優先

## フォールバック戦略

AgentCore Runtime に問題が発生した場合の段階的フォールバック：
1. Lambda Python + Raw Bedrock API（Strands なし）
2. Step Functions + Node.js + Bedrock API

## 関連 ADR

- [ADR 008: Step Functions による AI 分析の非同期化](./008-async-ai-analysis-with-step-functions.md)
