# TicTrack

介護者ファーストの、子どものチック症状を記録・分析する非診断アプリ。

AWS 10,000 AIdeas Competition 出展プロジェクト。

## ドキュメント

- [Amplify バックエンド実行ガイド](./amplify/README.md)
- [最終アーキテクチャ設計書](./docs/design/architecture_final.md)
- [実装ロードマップ](./docs/design/implementation_roadmap.md)

## 技術スタック

- **Frontend**: Next.js 14+ / Serwist PWA / Tailwind CSS / shadcn/ui / next-intl (i18n)
- **Backend**: Amplify Gen 2 + CDK / Node.js 20 (CRUD) / Python 3.12 (AI Agents)
- **AI**: Strands Agents SDK + AgentCore / Nova Pro / Claude Haiku / Bedrock Guardrails
- **DB**: DynamoDB (multi-table) / S3 / S3 Vectors (Knowledge Base)
- **Auth**: Cognito User Pool + Identity Pool

## 開発ワークフロー

このプロジェクトでは、厳格なブランチ管理とCI/CDを実施しています。

### Claude Code スキル

開発フローを効率化するため、プロジェクトローカルのスキルを用意しています（`.claude/skills/`）。

#### 利用可能なスキル

**1. `/start-feature` - 新しい feature ブランチを作成**
```bash
# Claude Code で以下のように実行:
/start-feature step3-video-upload
```
- `main` ブランチから最新の状態で新しい feature ブランチを作成
- ブランチ命名規則: `feature/step{N}-{description}`

**2. `/sync-main` - リモート main と同期**
```bash
/sync-main
```
- ローカル main を最新の状態に更新
- リモート追跡ブランチの状態も確認

**3. `/check-ci` - CI チェックをローカルで実行**
```bash
/check-ci
```
- テスト、Lint、ビルドを順次実行（CI と同じ）
- PR 作成前の事前確認に使用

**4. `/create-pr` - フォーマット済み PR を作成**
```bash
/create-pr
```
- テスト・Lint・ビルドチェックを実行
- 標準フォーマットで Pull Request を作成
- ベースブランチ: `main`

**5. `/cleanup-branch` - マージ済みブランチを削除**
```bash
/cleanup-branch
```
- ローカルとリモートのマージ済みブランチをクリーンアップ
- `main` / `master` / `develop` は保護

#### 推奨ワークフロー

```
1. /start-feature step{N}-{description}  # 新規 feature ブランチ作成
2. ... コード実装 ...
3. /check-ci                              # ローカルで CI チェック実行
4. /create-pr                             # PR 作成（自動で CI 実行）
5. ... PR レビュー & マージ ...
6. /sync-main                             # main を最新化
7. /cleanup-branch                        # 不要なブランチ削除
```

### CI/CD

GitHub Actions で以下のチェックを自動実行:

- **Test**: `npm run test`
- **Lint**: `npm run lint`
- **Build**: `npm run build`

トリガー: PR 作成時 / `main` への push 時
