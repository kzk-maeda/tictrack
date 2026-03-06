# Step 6: 週次レポート生成

> **日程**: Day 15-19
> **前提**: Step 5 完了（既出チック照合）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §10, §5.2, §6.2 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)
> **MVP ティア**: **目標デモ (Target Demo)** 完了ステップ

---

## 目標

週次 PDF 自動生成 → 週次チェックイン → ダウンロード → 共有リンク。

---

## 前提条件

- Step 5 までの全機能が完了
- Episodes テーブルにデータが蓄積されている

---

## 成果物

### Amplify バックエンド追加

| ファイル | 内容 |
|---------|------|
| `amplify/functions/report-generator/resource.ts` | defineFunction — レポート生成 Lambda |
| `amplify/functions/report-generator/handler.ts` | エピソード集計 + 統計 + strands.Agent テキスト生成 + PDF |
| `amplify/custom/orchestration/index.ts` | OrchestrationConstruct — Step Functions + EventBridge |

### Lambda API 追加

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/routes/check-ins.ts` | チェックイン CRUD |
| `amplify/functions/api-handler/routes/reports.ts` | レポート一覧・詳細・手動生成トリガー |
| `amplify/functions/api-handler/routes/share.ts` | 共有リンク生成・検証 |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/check-in/page.tsx` | 週次チェックイン入力 |
| `src/app/reports/page.tsx` | レポート一覧 |
| `src/app/reports/[id]/page.tsx` | レポート詳細 + PDF ビューワー |
| `src/app/shared/reports/[token]/page.tsx` | 共有リンク閲覧（認証不要） |
| `src/components/check-in/` | チェックイン関連コンポーネント |
| `src/components/reports/` | レポート関連コンポーネント |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2

### チェックイン

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/children/{childId}/check-ins?from=&to=` | チェックイン一覧 |
| POST | `/children/{childId}/check-ins` | チェックイン作成 |
| PUT | `/children/{childId}/check-ins/{checkInId}` | チェックイン更新 |

### レポート

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/children/{childId}/reports` | レポート一覧 |
| GET | `/children/{childId}/reports/{reportId}` | レポート詳細 + PDF URL |
| POST | `/children/{childId}/reports/generate` | 手動レポート生成トリガー |
| POST | `/children/{childId}/reports/{reportId}/share` | 共有リンク生成 |
| GET | `/shared/reports/{shareToken}` | 共有トークンによる閲覧（認証不要） |
| GET | `/shared/videos/{shareToken}` | 共有トークンによる動画閲覧（認証不要） |

---

## Step Functions ワークフロー

> 参照: `architecture_final.md` §10.1

```
EventBridge (毎週月曜 9:00 JST = UTC 0:00)
  → Step Functions
    → 全ユーザーの子ども一覧取得
    → Map State (MaxConcurrency: 3)
      → 各子どもの処理:
        1. エピソード集計（childId + occurredAt で取得）
        2. チェックインデータ取得
        3. 統計計算（Missing-Data Tolerant）
        4. レポートテキスト生成（strands.Agent インライン + Guardrails）
        5. PDF 生成（pdfkit + chartjs-node-canvas）
        6. S3 保存
        7. DDB 更新
    → 完了
```

### 設計ポイント

- **Map ステート**: Inline Map（プロトタイプ規模）
- **MaxConcurrency: 3**: Lambda 同時実行数 + Bedrock レート制限考慮
- **エラーハンドリング**: 個別失敗が他に影響しない（Catch 設定）
- **タイムアウト**: 子ども 1 名 5 分、全体 30 分

---

## 統計計算（Missing-Data Tolerant）

> 参照: `architecture_final.md` §10.2

### 最低観測閾値

| 記録日数 | 処理 |
|---------|------|
| 0 日 | レポート生成スキップ（`status: "skipped"`） |
| 1-2 日 | 基本カウントのみ（傾向分析なし） |
| 3 日以上 | フルレポート |

### データ品質ラベル

| 記録日数 | ラベル |
|---------|--------|
| 5-7 日 | 「十分なデータ」（グリーン） |
| 3-4 日 | 「参考データ」（イエロー） |
| 1-2 日 | 「データ不足」（グレー） |

### 統計項目

- 記録概要: エピソード数、記録日数/7
- 前週比変化: 1記録日あたりの平均で正規化
- 重さ分布: severity 1/2/3 の割合
- 時間帯分布: 朝/昼/夕/夜
- チックタイプ別: motor/vocal/both
- 代表エピソード: 最高 severity / 最頻パターン / 新規候補 (1-3 件)
- チェックインデータ: 生活イベント、不安スコア

---

## PDF 生成

> 参照: `architecture_final.md` §10.4

- **ライブラリ**: pdfkit（純粋 JS, < 5MB）
- **チャート**: chartjs-node-canvas で PNG → PDF 埋め込み
- **構成**: ヘッダー → チェックイン → 統計 → グラフ → 代表エピソード → 免責事項
- **出力先**: `reports/{userId}/{childId}/{reportId}/weekly_report.pdf`

### 免責事項テキスト

```
このレポートは、今週記録された観察のみに基づいています。
記録されていない時間帯にも症状が発生している可能性があります。
本レポートは医学的診断を提供するものではなく、症状の傾向を視覚化するツールです。
傾向の解釈は、医療専門家とご相談ください。
```

---

## 共有リンク

> 参照: `architecture_final.md` §7.4, §10.5

- ShareTokens テーブルでトークン管理
- 有効期限: 24/48/72 時間（親が選択）
- 動画共有はオプトイン
- 期限切れ → 410 Gone

---

## backend.ts 変更

Step 6 到達時、`backend.ts` の以下のコメントを解除:

```typescript
// import { reportGenerator } from './functions/report-generator/resource';
// defineBackend に reportGenerator 追加
// const orchestrationStack = backend.createStack('orchestration-stack');
// const orchestration = new OrchestrationConstruct(orchestrationStack, 'Orchestration', { ... });
// report-generator Lambda の IAM grants
```

---

## TDD テスト項目

- [ ] EventBridge ルールが cron 式 `cron(0 0 ? * MON *)` で設定されていること
- [ ] 手動レポート生成 API が Step Functions ワークフローを開始し、`reportId` を返すこと
- [ ] エピソード集計: 指定期間のエピソードが `childId` + `occurredAt` で正しく取得されること
- [ ] 統計計算: 記録日 5 日・エピソード 12 件 → 1 日平均 2.4 件と計算されること
- [ ] 前週比: 今週平均 2.4 件/日、先週平均 2.0 件/日 → 変化率 +20% と計算されること
- [ ] データ品質ラベル: 記録日 5-7 日 → 「十分なデータ」、3-4 日 → 「参考データ」、1-2 日 → 「データ不足」が返されること
- [ ] 記録日 0 日の場合にレポート生成がスキップされ、ステータスが `skipped` になること
- [ ] 記録日 1-2 日の場合に傾向分析が含まれず、基本カウントのみのレポートが生成されること
- [ ] PDF がバイナリとして有効な PDF ファイル（ヘッダー `%PDF`）であること
- [ ] PDF に子ども情報、期間、データ品質ラベル、統計サマリー、免責事項テキストが含まれること
- [ ] 代表クリップ選択: 最高 severity のエピソードが選択されること
- [ ] 共有リンク生成 API が `shareToken`（UUID）と有効期限を返すこと
- [ ] 有効期限内の共有トークンでレポート PDF の Presigned URL が取得できること
- [ ] 有効期限切れの共有トークンで 410 Gone が返されること
- [ ] チェックイン作成 API が `caregiverAnxietyScore`（1-5 範囲）を正しく保存すること
- [ ] チェックイン作成 API で `caregiverAnxietyScore` が 0 以下または 6 以上の場合にバリデーションエラーが返されること
- [ ] レポートにチェックインデータ（生活イベント、不安スコア）が反映されること
- [ ] チェックインが未入力の場合にレポートに「未入力」と表示されること
- [ ] Map ステートで 2 名以上の子どものレポートが並列に生成されること
- [ ] Map ステート内で 1 名の処理が失敗しても、他の子どもの処理が継続すること
- [ ] レポートテキスト生成 Lambda 内で `strands.Agent` がインライン呼び出しでテキストを生成すること

---

## リスクチェックポイント

> **Day 19 時点**: Step 6 が完了していなければ Step 7 を簡略化/スキップ

---

## 完了基準

- 1 週間分のデータ → 手動トリガーで PDF 生成 → ダウンロード → 共有リンク生成
- **目標デモ (Target Demo)** のデモシナリオが動作する
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 7: RAG マイクロガイド](../step7/README.md)
