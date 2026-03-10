# ADR 003: Multi-table DynamoDB 設計の採用

## ステータス

承認済み（2026-03-06）

## 背景

DynamoDB のテーブル設計として以下を検討：

### 選択肢 1: Single Table Design
- 1 つのテーブルに全エンティティを格納
- PK/SK で異なるエンティティを区別
- アクセスパターンを最適化
- 本番環境での推奨パターン

### 選択肢 2: Multi-table Design
- エンティティごとに独立したテーブル
- 直感的なデータモデル
- シンプルなクエリ
- プロトタイプ開発に適する

### 問題点
- プロトタイプを 29 日で完成させる必要がある
- データモデルが頻繁に変更される可能性
- 複数の開発者が関わる可能性は低い
- 本番運用は競技会後に検討

## 決定

**Multi-table DynamoDB 設計を採用する。**

8 つのテーブル：
1. `Users` (PK: userId)
2. `Children` (PK: childId, GSI: userId)
3. `TicCards` (PK: cardId, GSI: childId)
4. `Episodes` (PK: episodeId, GSI: childId-occurredAt)
5. `AILabels` (PK: episodeId, SK: version)
6. `CheckIns` (PK: checkInId, GSI: childId-weekStart)
7. `WeeklyReports` (PK: reportId, GSI: childId-weekStart)
8. `ShareTokens` (PK: shareToken, TTL)

理由：
1. **開発速度**: テーブル構造が直感的でクエリが簡単
2. **変更容易性**: スキーマ変更が独立して可能
3. **デバッグ**: AWS Console でデータを確認しやすい
4. **学習コスト**: Single Table Design の高度な知識不要
5. **プロトタイプ適性**: 複雑さよりも速度を優先

## 結果

### ポジティブ
- ✅ 開発速度が向上（テーブル構造が自明）
- ✅ スキーマ変更が容易（Step 4 で executionArn フィールド追加など）
- ✅ デバッグが簡単（DynamoDB Console で直接確認）
- ✅ IAM ポリシーがシンプル（テーブルごとに権限設定）

### ネガティブ
- ❌ コスト: Single Table より読み取り/書き込みユニットが多い可能性
- ❌ トランザクション: 複数テーブル間の一貫性が難しい
- ❌ スケーラビリティ: 本番環境での最適化が必要になる可能性

### トレードオフ
- **パフォーマンス最適化** vs **開発速度** → 開発速度を優先
- **コスト効率** vs **シンプルさ** → シンプルさを優先

## 将来の移行

本番環境では Single Table Design への移行を検討：
- データ移行スクリプトの作成
- アクセスパターンの分析
- コスト比較

## 関連 ADR

なし
