# Step 8: ポリッシュ + デモ準備

> **日程**: Day 22-27
> **前提**: Step 7 完了（RAG マイクロガイド）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §4.5, §11.4, §13 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)
> **MVP ティア**: **フルデモ (Full Demo)** 完了ステップ

---

## 目標

デモ品質の UI/UX + Builder Center 記事。

---

## 前提条件

- Step 7 までの全機能が完了（または利用可能な範囲で完了）

---

## 成果物

### UI/UX 改善

| 対象 | 内容 |
|------|------|
| レスポンシブデザイン | モバイル中心（375px 幅）で検証 |
| ローディング状態 | 一貫したスピナー/スケルトン表示 |
| エラー状態 | 統一されたエラーハンドリング UI |
| アニメーション | 最小限のトランジション |
| アクセシビリティ | 基本対応（aria-label, キーボードナビゲーション） |

### オフラインキュー

| ファイル | 内容 |
|---------|------|
| `src/lib/offline-queue.ts` | IndexedDB オフラインキュー管理 |
| `src/lib/sync.ts` | バックグラウンド同期 |

### データ削除フロー

| ファイル | 内容 |
|---------|------|
| `amplify/functions/data-deletion/resource.ts` | defineFunction — データ削除 Lambda |
| `amplify/functions/data-deletion/handler.ts` | カスケード削除実行 |
| `amplify/custom/orchestration/index.ts` | 削除ワークフロー追加 |
| `amplify/functions/api-handler/routes/account.ts` | DELETE /account API |

### E2E テスト

| ファイル | 内容 |
|---------|------|
| `e2e/auth-flow.spec.ts` | 認証フロー E2E |
| `e2e/video-analysis.spec.ts` | 動画 → AI 分析 E2E |
| `e2e/report-generation.spec.ts` | レポート生成 E2E |

### Builder Center 記事

| ファイル | 内容 |
|---------|------|
| `docs/builder-center-article.md` | 記事ドラフト |

### デモデータ

| ファイル | 内容 |
|---------|------|
| `scripts/seed-data.ts` | シードデータ投入スクリプト |

---

## 作業内容

### 1. UI/UX 改善

- モバイルビューポート（375px 幅）でメイン画面の表示確認
- ローディング/エラー状態の一貫したハンドリング
- 最小限のアニメーション・トランジション
- アクセシビリティ基本対応

### 2. E2E テスト（Playwright）

> 参照: `architecture_final.md` §13.4

主要フロー 3-5 シナリオ:

1. **認証フロー**: サインアップ → ログイン → 子ども登録 → チックカード作成 → ワンタップ記録
2. **動画分析フロー**: 動画撮影 → アップロード → AI 分析 → ラベル確認
3. **レポートフロー**: レポート生成 → PDF ダウンロード → 共有リンク生成（Step 6 完了の場合）

### 3. オフラインキュー

> 参照: `architecture_final.md` §4.5

#### Serwist キャッシュ戦略

| リソース | 戦略 |
|---------|------|
| App Shell (HTML/CSS/JS) | Cache First |
| API レスポンス | Network First |
| 画像・サムネイル | Stale While Revalidate |
| 動画ファイル | Network Only |

#### IndexedDB オフラインキュー

```
IndexedDB: "tictrack-offline"
├── Store: "pending-episodes"     # 未同期のエピソード記録
├── Store: "pending-videos"       # 未アップロードの動画 Blob
└── Store: "sync-status"          # 同期状態管理
```

#### 同期フロー

1. `navigator.onLine` + `online`/`offline` イベントで監視
2. オンライン復帰時、`pending-episodes` を順次 API に送信
3. 動画は Presigned URL → S3 アップロード → AI パイプライン起動
4. 同期完了 → IndexedDB から削除

> **MVP スコープ**: オフラインでのチックカード記録（動画なし）は必須。動画のオフライン保存は時間次第。

### 4. データ削除フロー

> 参照: `architecture_final.md` §11.4

#### アカウント削除カスケード

```
DELETE /account → Step Functions
  → 子ども一覧取得
  → Map: 各子どもの削除
    → エピソード一覧取得
    → Map: 各エピソードの削除
      → S3 動画 + サムネイル削除
      → AILabels 削除
    → Episodes 一括削除
    → TicCards 削除
    → CheckIns 削除
    → WeeklyReports + S3 PDF 削除
    → ShareTokens 削除
    → Children 削除
  → Users 削除
  → Cognito ユーザー削除
```

#### 個別エピソード削除

- S3 動画 + サムネイル → AILabels → Episodes

### 5. パフォーマンス最適化

- Lighthouse スコア改善
- 画像最適化
- バンドルサイズ最適化

### 6. Builder Center 記事執筆

- プロジェクト紹介・技術スタック・使用 AWS サービス
- アーキテクチャ図
- デモ動画/スクリーンショット
- Kiro 使用方法の説明

### 7. デモ用シードデータ

- 1-2 週間分のサンプルエピソード + レポート
- 複数チックカード（motor/vocal）
- AI ラベル付きエピソード

---

## backend.ts 変更

Step 8 到達時、`backend.ts` の以下のコメントを解除:

```typescript
// import { dataDeletion } from './functions/data-deletion/resource';
// defineBackend に dataDeletion 追加
// OrchestrationConstruct にデータ削除ワークフロー追加
```

---

## TDD テスト項目

- [ ] E2E: サインアップ → ログイン → 子ども登録 → チックカード作成 → ワンタップ記録 の全フロー
- [ ] E2E: 動画撮影 → アップロード → AI 分析 → ラベル確認 の全フロー
- [ ] E2E: レポート生成 → PDF ダウンロード → 共有リンク生成 の全フロー（Step 6 まで完了の場合）
- [ ] オフライン状態でのチックカード記録が IndexedDB に保存されること
- [ ] オンライン復帰時に IndexedDB のデータが API に送信され、同期完了後に IndexedDB から削除されること
- [ ] アカウント削除 API が Step Functions ワークフローを開始し、全関連データが削除されること
- [ ] 子ども削除時にその子どもの Episodes, TicCards, AILabels, CheckIns, WeeklyReports, ShareTokens が全て削除されること
- [ ] Cognito ユーザーが DynamoDB 削除完了後に削除されること
- [ ] モバイルビューポート（375px 幅）でメイン画面が正しく表示されること

---

## リスクチェックポイント

> **Day 25 までに Step 8 が完了しない場合**: 記事執筆に全力集中。オフラインキュー・データ削除カスケードは見送り。

---

## 完了基準

- デモ品質のアプリ（全フロー動作、UI/UX 整備済み）
- E2E テスト通過
- Builder Center 記事ドラフト完成
- **フルデモ (Full Demo)** のデモシナリオが動作する
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 9: バッファ + 最終提出](../step9/README.md)
