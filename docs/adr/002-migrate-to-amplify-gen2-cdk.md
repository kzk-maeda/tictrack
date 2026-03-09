# ADR 002: Amplify Gen 2 + CDK への移行

## ステータス

承認済み（2026-03-06）

## 背景

IaC（Infrastructure as Code）ツールとして以下を比較：

### 選択肢 1: Terraform
- 汎用的で広く使われている
- AWS 以外のプロバイダーもサポート
- 状態管理が必要

### 選択肢 2: Amplify Gen 2 + CDK
- AWS 公式のフルスタック開発ツール
- CDK でカスタム構成が可能
- Next.js との統合が強力
- Hosting（CI/CD）も含む

### 問題点
- プロトタイプ開発で速度が重要
- Next.js フロントエンドと統合したい
- 複雑なバックエンド（Step Functions, AgentCore）が必要
- CI/CD パイプラインも必要

## 決定

**Amplify Gen 2 + CDK を採用する。**

理由：
1. **統合開発体験**: フロントエンド（Next.js）とバックエンド（API, Auth, Storage）を一括管理
2. **CDK の柔軟性**: カスタム Construct で複雑なリソース（Step Functions, AgentCore）を定義可能
3. **Sandbox 開発**: `npx ampx sandbox` でローカル開発環境が即座に立ち上がる
4. **CI/CD 組み込み**: Amplify Hosting で Git push → 自動デプロイ
5. **段階的有効化**: `backend.ts` でリソースをコメントアウトし、段階的に有効化

## 結果

### ポジティブ
- ✅ 開発速度が劇的に向上（Sandbox で即座にテスト）
- ✅ Next.js との統合が完璧（`amplify_outputs.json` 自動生成）
- ✅ Custom Construct で高度な構成が可能
- ✅ TypeScript で IaC を記述、型安全性確保
- ✅ 段階的デプロイで Risk 管理

### ネガティブ
- ❌ Amplify Gen 2 の学習コスト（Gen 1 とは異なる）
- ❌ AWS 専用（マルチクラウド不可）
- ❌ 一部の機能が制限（例: `defineData` を使わず REST API に）

### トレードオフ
- **柔軟性** vs **開発速度** → 開発速度を優先
- **マルチクラウド** vs **AWS 最適化** → AWS 最適化を優先

## 実装パターン

```typescript
// amplify/backend.ts
const backend = defineBackend({ auth, storage, apiHandler });

// Custom Construct for advanced resources
const orchestrationStack = backend.createStack("orchestration-stack");
const orchestration = new OrchestrationConstruct(orchestrationStack, "Orchestration", {
  // ...
});
```

## 関連 ADR

なし
