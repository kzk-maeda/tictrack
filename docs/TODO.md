- [] MIME type対応拡充
- [] モバイル対応

## 環境管理
- [ ] Amplify Branch Environments への移行（Step 6-7 完了後 or コンペ提出前）
  - Production 環境デプロイ: `npx ampx pipeline-deploy --branch main`
  - ローカル接続先切り替え対応（run_local.sh に AMPLIFY_BRANCH 追加）
  - データ移行スクリプト作成（必要な場合）
- [] AWS Lambda Node.js 20.x サポート終了対応

## Step 4: AI Labeling（継続タスク）
- [x] Tic Labeling Agent 実装・テスト完了
- [x] Docker + ECR セットアップ
- [x] AgentCore Runtime デプロイ完了
- [x] Lambda Proxy 実装完了（API Gateway → Lambda → AgentCore）
  - Lambda 関数: agentcore-proxy (Node.js 20, @aws-sdk/client-bedrock-agentcore)
  - API ルート: POST /analyze/{episodeId} (Cognito 認証)
  - IAM 権限: bedrock-agentcore:InvokeAgentRuntime
  - 環境変数: AGENTCORE_RUNTIME_ARN, DynamoDB テーブル
- [ ] AI ラベル UI 実装（フィードバック機能含む）
- [ ] エンドツーエンドテスト（Frontend → API → Lambda → AgentCore → DynamoDB）

## Step 5: マッチング機能
- [ ] 類似エピソード検索 API 実装
- [ ] マッチング UI 実装

## Step 6: 週次レポート
- [ ] Step Functions ワークフロー実装
- [ ] レポート生成 Lambda 実装
- [ ] PDF 生成機能
- [ ] レポート UI 実装

## Step 7: マイクログガイド
- [ ] Micro-Guide Agent 実装
- [ ] Knowledge Base セットアップ
- [ ] ガイド UI 実装

## Step 8: 最終調整
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング改善
- [ ] デモ準備
- [ ] ドキュメント整備

## コンペ提出準備
- [ ] Production 環境へのデプロイ
- [ ] Builder Center 記事執筆
- [ ] デモビデオ作成
- [ ] 最終動作確認