# Architecture Decision Records (ADR)

このディレクトリには、TicTrack プロジェクトの重要なアーキテクチャ判断を記録します。

## ADR とは

Architecture Decision Record (ADR) は、アーキテクチャ上の重要な判断とその理由を記録するドキュメントです。

## フォーマット

[Nygard ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) フォーマットに準拠：

- **タイトル**: 決定内容を端的に表す
- **ステータス**: 提案中/承認済み/却下/廃止/置き換え
- **背景**: なぜこの判断が必要だったか
- **決定**: 何を選択したか
- **結果**: この判断の影響（ポジティブ/ネガティブ両方）

## ADR 一覧

| No | タイトル | ステータス | 日付 |
|----|---------|----------|------|
| 001 | [Strands Agents SDK + AgentCore Runtime の採用](./001-adopt-strands-agents-sdk.md) | 承認済み | 2026-03-06 |
| 002 | [Amplify Gen 2 + CDK への移行](./002-migrate-to-amplify-gen2-cdk.md) | 承認済み | 2026-03-06 |
| 003 | [Multi-table DynamoDB 設計の採用](./003-adopt-multi-table-dynamodb.md) | 承認済み | 2026-03-06 |
| 004 | [Amazon Nova Pro をビデオ分析に採用](./004-adopt-nova-pro-for-video.md) | 承認済み | 2026-03-06 |
| 005 | [S3 Vectors for Knowledge Bases の採用](./005-adopt-s3-vectors-for-kb.md) | 承認済み | 2026-03-06 |
| 006 | [Serwist を PWA に採用](./006-adopt-serwist-for-pwa.md) | 承認済み | 2026-03-06 |
| 007 | [next-intl を i18n に採用](./007-adopt-next-intl-for-i18n.md) | 承認済み | 2026-03-08 |
| 008 | [Step Functions による AI 分析の非同期化](./008-async-ai-analysis-with-step-functions.md) | 承認済み | 2026-03-09 |
| 009 | [AI ラベルデータ構造の修正と後方互換性](./009-ai-label-backward-compatibility.md) | 承認済み | 2026-03-10 |

## ADR の作成ルール

1. **連番**: `XXX-short-title.md` 形式（例: `001-adopt-strands-agents-sdk.md`）
2. **言語**: 日本語で記載
3. **範囲**: アーキテクチャレベルの判断のみ（実装の詳細は不要）
4. **更新**: 判断が変更された場合、古い ADR は「置き換え」ステータスにし、新しい ADR を作成
5. **参照**: 関連する ADR は相互参照すること

## ADR を書くべき判断

- ✅ 技術スタックの選択
- ✅ アーキテクチャパターンの選択
- ✅ データモデルの設計方針
- ✅ インフラストラクチャの構成
- ✅ セキュリティポリシー
- ✅ パフォーマンス最適化の方針
- ❌ 関数名の命名規則
- ❌ コードフォーマットのスタイル
- ❌ 個別の実装の詳細
