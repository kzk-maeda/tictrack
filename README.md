# TicTrack

介護者ファーストの、子どものチック症状を記録・分析する非診断アプリ。

AWS 10,000 AIdeas Competition 出展プロジェクト。

## ドキュメント

- [Amplify バックエンド実行ガイド](./amplify/README.md)
- [最終アーキテクチャ設計書](./docs/design/architecture_final.md)
- [実装ロードマップ](./docs/design/implementation_roadmap.md)

## 技術スタック

- **Frontend**: Next.js 14+ / Serwist PWA / Tailwind CSS / shadcn/ui
- **Backend**: Amplify Gen 2 + CDK / Node.js 20 (CRUD) / Python 3.12 (AI Agents)
- **AI**: Strands Agents SDK + AgentCore / Nova Pro / Claude Haiku / Bedrock Guardrails
- **DB**: DynamoDB (multi-table) / S3 / S3 Vectors (Knowledge Base)
- **Auth**: Cognito User Pool + Identity Pool
