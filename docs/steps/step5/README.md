# Step 5: 既出チック照合

> **日程**: Day 13-15
> **前提**: Step 4 完了（AI ラベリング基本）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §8.4, §5.2 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)

---

## 目標

AI が既出チックカードとの一致を提案 + 一括レビュー機能。

---

## 前提条件

- Step 4 の Tic Labeling Agent が動作中
- `match_existing_tics` ツールが基本実装済み（Step 4 で Agent の一部として統合）

---

## 成果物

### Python Agent（改善）

| ファイル | 内容 |
|---------|------|
| `agents/tic_labeling/tools/match_tics.py` | プロンプトチューニング・精度改善 |

### Lambda API 追加

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/routes/review.ts` | 一括レビュー API |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/review/page.tsx` | 一括レビュー画面 |
| `src/components/review/` | レビュー関連コンポーネント |
| `src/components/episodes/MatchSuggestion.tsx` | 一致提案表示コンポーネント |
| `src/components/tic-cards/NewTicCardDialog.tsx` | 新規チックカード提案ダイアログ |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/children/{childId}/episodes/pending-review` | 未確認ラベル一覧 |
| PUT | `/children/{childId}/episodes/bulk-confirm` | 一括確認 |

### リクエスト例

**PUT `/children/{childId}/episodes/bulk-confirm`**:
```json
{
  "confirmations": [
    {
      "episodeId": "01HXYZ...",
      "action": "confirm_as_is"
    },
    {
      "episodeId": "01HABC...",
      "action": "edit",
      "editedLabel": {
        "type": "motor",
        "severity": 2,
        "context": "bedtime",
        "ticCardId": "01HCARD..."
      }
    }
  ]
}
```

---

## 作業内容

### 1. `match_existing_tics` ツールのプロンプトチューニング

> Step 4 で基本実装済み。Step 5 では精度改善に集中。

- 一致判定の閾値調整（confidence 0.7 以上で「一致」と提案）
- confidence 0.7 未満は「新しいチック候補」
- 既出チックカードが 0 件の場合はスキップ → `isNewTic = true`
- `suggestedLabel` の生成（新規チック候補の場合）

### 2. 一致提案 UI

- エピソード詳細画面に一致提案を表示:
  - 「既存の"首振り"と一致（85%）」
  - 「新しいチック候補」→「新しいチックカードを作成しますか？」ダイアログ
- `matchedTicCardId` を `originalAILabel.matchedTicCardId` に保存

### 3. 一括レビュー機能

- **GET `/pending-review`**: `labelStatus = "ai_suggested"` のエピソードを取得
  - GSI `childId-occurredAt-index` で取得 → アプリ側で `labelStatus` フィルタ
- **PUT `/bulk-confirm`**: 複数エピソードのラベルを一括確認
  - `action: "confirm_as_is"` → `feedbackType: "confirmed_as_is"`
  - `action: "edit"` → `editedLabel` を `confirmedLabel` に反映
- 一括レビュー UI (`/review`): 未確認ラベルのリスト + チェックボックス + 一括確認ボタン

---

## TDD テスト項目

- [ ] Agent の `match_existing_tics` ツールが `best_match.cardId` と `best_match.confidence`（0.0-1.0）を返すこと
- [ ] confidence が 0.7 以上の場合に「既出チックと一致」として提案されること
- [ ] confidence が 0.7 未満の場合に「新しいチック候補」と判定されること
- [ ] 既出チックカードが 0 件の場合にマッチングツールがスキップされ、`isNewTic = true` となること
- [ ] `matchedTicCardId` が Episodes テーブルの `originalAILabel.matchedTicCardId` に保存されること
- [ ] 新規チックカード提案時に `suggestedLabel` が返されること
- [ ] 一括確認 API（PUT `/bulk-confirm`）が複数エピソードの `labelStatus` を `confirmed` に更新すること
- [ ] 一括確認で `action: "edit"` のエピソードに対して `editedLabel` が `confirmedLabel` に反映されること
- [ ] 一括確認で `action: "confirm_as_is"` のエピソードに `feedbackType: "confirmed_as_is"` が記録されること
- [ ] 未確認ラベル一覧 API（GET `/pending-review`）が `labelStatus = "ai_suggested"` のエピソードのみを返すこと

---

## 完了基準

- 新動画アップ → AI が「既存の"首振り"と一致（85%）」と提案 → 親が確認 or 新規カード作成
- 一括レビュー画面で複数のラベルをまとめて確認可能
- 全 TDD テスト項目が Green

---

## 次のステップ

→ [Step 6: 週次レポート生成](../step6/README.md)
