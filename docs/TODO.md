## 環境管理
- [ ] Amplify Branch Environments への移行（Step 6-7 完了後 or コンペ提出前）
  - Production 環境デプロイ: `npx ampx pipeline-deploy --branch main`
  - ローカル接続先切り替え対応（run_local.sh に AMPLIFY_BRANCH 追加）
  - データ移行スクリプト作成（必要な場合）
- [] AWS Lambda Node.js 20.x サポート終了対応
- [] MIME type対応拡充
- [x] モバイル対応（メニュータブをモバイルUIでも違和感なく表示できる様に）
- [x] 優しいカラーデザインへの変更
- [x] タイムラインをカレンダーUIに変更
- [x] チックの種類を症例に合わせて修正
- [ ] 投薬データ登録動線の実装
- [] デモ用ダミーデータの投入
- [] デモモードの実装
- [x] CIの効率化（テストとE2Eがシリアルで実行され、それぞれに顕教セットアップが必要なので時間がかかる）

## Step 4: AI Labeling ✅ 完了（2026-03-08）
- [x] Tic Labeling Agent 実装・テスト完了
  - Nova Pro ビデオ分析（6 tools: analyze_video, transcribe_audio, integrate_results, apply_guardrails, store_label, get_child_info）
  - Strands Agents SDK + FastAPI
  - Docker ARM64 コンテナ
- [x] Docker + ECR セットアップ
- [x] AgentCore Runtime デプロイ完了
  - IAM Execution Role（Bedrock, Transcribe, DynamoDB, S3, CloudWatch Logs）
  - 環境変数: EPISODES_TABLE, AI_LABELS_TABLE, CHILDREN_TABLE, S3_MEDIA_BUCKET
- [x] Lambda Proxy 実装完了（API Gateway → Lambda → AgentCore）
  - Lambda 関数: agentcore-proxy (Node.js 20, @aws-sdk/client-bedrock-agentcore v3.716.0)
  - API ルート: POST /analyze/{episodeId} (Cognito 認証)
  - IAM 権限: bedrock-agentcore:InvokeAgentRuntime, DynamoDB GetItem/UpdateItem
  - SDK invocation with DEFAULT qualifier
- [x] エンドツーエンドテスト完了（Frontend → API → Lambda → AgentCore → Tools → DynamoDB）
  - 実際の S3 ビデオファイルで分析成功
  - AI ラベル DynamoDB 保存確認
- [x] `"error": "Agent did not return a result"` の解消
  - 修正: AgentCore Runtime ARN フォーマット（`runtime/` not `agent-runtime/`）
  - 修正: イベントストリーミングパターン（`event["result"]` extraction）
  - 修正: ログ出力（`print()` for AgentCore Runtime）
- [x] AI ラベル UI 実装（フィードバック機能含む）
- [x] LLMモデルの最新化

## Step 5: マッチング機能
- [ ] 類似エピソード検索 API 実装
- [ ] マッチング UI 実装
- [ ] 動画の分析結果からカードを作成する機能の実装

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
