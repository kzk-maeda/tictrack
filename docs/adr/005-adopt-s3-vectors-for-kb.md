# ADR 005: S3 Vectors for Knowledge Bases の採用

## ステータス

承認済み（2026-03-06）

## 背景

Bedrock Knowledge Bases のベクトルデータベースとして以下を検討：

### 選択肢 1: OpenSearch Serverless
- フルマネージド検索サービス
- 高機能（複雑なクエリ、集計）
- コストが高い

### 選択肢 2: S3 Vectors
- S3 にベクトルデータを保存
- Bedrock が自動で index 管理
- コストが 90% 削減

### 問題点
- マイクロガイド機能で医療ガイドライン（PDF）を参照
- 検索クエリは単純（類似文書検索のみ）
- 月次コストを最小化したい
- プロトタイプ段階で高機能は不要

## 決定

**S3 Vectors を採用する。**

理由：
1. **コスト効率**: OpenSearch の 10% のコスト
2. **シンプルさ**: S3 バケットに PDF をアップロードするだけ
3. **自動 Index**: Bedrock が自動で embedding と index を管理
4. **十分な機能**: RAG 用途には十分

コスト試算（10MB の PDF, 月 1,000 クエリ）：
- OpenSearch: **~$70/月**（最小構成でも固定費）
- S3 Vectors: **~$7/月**（ストレージ + クエリ課金のみ）

## 結果

### ポジティブ
- ✅ コストが 90% 削減
- ✅ セットアップがシンプル（S3 バケット作成のみ）
- ✅ メンテナンス不要（Bedrock が自動管理）
- ✅ プロトタイプ開発速度が向上

### ネガティブ
- ❌ 複雑な検索クエリは不可
- ❌ リアルタイム更新が遅い（数分の遅延）
- ❌ 分析機能なし

### トレードオフ
- **高機能性** vs **コスト効率** → コスト効率を優先
- **リアルタイム性** vs **シンプルさ** → シンプルさを優先

## 使用パターン

```python
# FoundationConstruct で S3 バケット作成
knowledge_bucket = s3.Bucket(...)

# Bedrock Knowledge Base で参照
knowledge_base = bedrock.CfnKnowledgeBase(
    storage_configuration={
        "type": "S3",
        "s3Configuration": {
            "bucketArn": knowledge_bucket.bucket_arn
        }
    }
)
```

## 将来の移行

本番環境で以下が必要になった場合は OpenSearch へ移行：
- 複雑な検索クエリ（フィルタリング、ファセット）
- リアルタイム更新（秒単位）
- 検索分析（ランキング、A/B テスト）

## 関連 ADR

- [ADR 001: Strands Agents SDK + AgentCore Runtime の採用](./001-adopt-strands-agents-sdk.md)
