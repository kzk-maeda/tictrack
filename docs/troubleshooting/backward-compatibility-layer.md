# AI Label 後方互換性レイヤー

## 作成日
2026-03-10

---

## 背景

### 問題
DynamoDB の `Episodes.originalAILabel` に旧フォーマットのデータが残っている：

**旧フォーマット**:
```json
{
  "type": "motor",
  "severity": 2,
  "context": "Observable movements detected...",
  "confidence": 0.9
}
```

**新フォーマット（期待値）**:
```json
{
  "primaryTic": {
    "type": "motor",
    "complexity": "simple",
    "symptomId": "motor_simple_eye_blinking",
    "confidence": 0.95
  },
  "severity": 3,
  "observations": [...]
}
```

### 症状
- データは DynamoDB に存在する
- UI では「運動性 + 音声性」「強度 3/5」のフォールバック値が表示される
- 実際のデータ（`type: "motor"`, `severity: 2`）が表示されない

---

## 解決策: 正規化レイヤー

### アプローチ
旧フォーマットを新フォーマットに**正規化**する処理を追加：
- `type` → `suggestedType`
- `context` → `suggestedContext`
- `severity` → `suggestedSeverity` および `severity`
- `confidence` → `confidence`

### 実装箇所

#### 1. Frontend: timeline-day-group.tsx
**ファイル**: `src/components/timeline/timeline-day-group.tsx`
**行**: 69-74

```typescript
aiLabel = {
  episodeId: episode.episodeId,
  version: 1,
  modelId: "nova-pro-v1",
  rawOutput: "",
  primaryTic: labelData.primaryTic,
  secondaryTics: labelData.secondaryTics,
  severity: labelData.severity ?? labelData.suggestedSeverity,
  observations: labelData.observations,
  // 旧フォーマット → 新フォーマット 正規化
  suggestedType: labelData.suggestedType ?? labelData.type,          // ✅
  suggestedSeverity: labelData.suggestedSeverity ?? labelData.severity, // ✅
  suggestedContext: labelData.suggestedContext ?? labelData.context,    // ✅
  confidence: labelData.confidence ?? labelData.primaryTic?.confidence,
  createdAt: episode.updatedAt,
};
```

**効果**:
- 初回表示時に旧データを正規化
- UI が `suggestedType` / `suggestedContext` を使ってフォールバック表示

#### 2. Backend: episodes.ts API
**ファイル**: `amplify/functions/api-handler/routes/episodes.ts`
**行**: 54-59

```typescript
// Normalize old format to new format for backward compatibility
const normalized = {
  ...aiLabel,
  severity: aiLabel.severity ?? aiLabel.suggestedSeverity,
  // 旧フォーマット → 新フォーマット 正規化
  suggestedType: aiLabel.suggestedType ?? aiLabel.type,          // ✅
  suggestedSeverity: aiLabel.suggestedSeverity ?? aiLabel.severity, // ✅
  suggestedContext: aiLabel.suggestedContext ?? aiLabel.context,    // ✅
  confidence: aiLabel.confidence,
};
```

**効果**:
- `/children/{childId}/episodes/{episodeId}/ai-label` API
- `/children/{childId}/episodes/{episodeId}/analysis-status` API
- ポーリング経由の更新でも正規化済みデータが返る

#### 3. 型定義の更新
**ファイル**: `src/lib/types.ts`, `amplify/functions/api-handler/types.ts`

```typescript
export interface EpisodeAILabel {
  primaryTic?: TicSymptom;
  secondaryTics?: TicSymptom[];
  severity?: number; // 1-5
  observations?: Array<{...}>;
  // Legacy fields for backward compatibility
  type?: "motor" | "vocal" | "both";          // ✅ 旧フォーマット
  context?: string;                           // ✅ 旧フォーマット
  suggestedType?: "motor" | "vocal" | "both";
  suggestedSeverity?: number;
  suggestedContext?: string;
  confidence?: number;
}
```

**効果**:
- TypeScript が旧フィールドの存在を許容
- `npx tsc --noEmit` がエラーなく通る

---

## 動作確認

### 旧フォーマットデータの場合

**DynamoDB レコード**:
```json
{
  "episodeId": "01KKADKBTN8QZ3EEVAZ3NG7775",
  "originalAILabel": {
    "type": "motor",
    "severity": 2,
    "context": "Observable movements detected...",
    "confidence": 0.9
  }
}
```

**正規化後（UI に渡される）**:
```json
{
  "episodeId": "01KKADKBTN8QZ3EEVAZ3NG7775",
  "primaryTic": undefined,
  "severity": 2,
  "suggestedType": "motor",          // ← type から正規化
  "suggestedSeverity": 2,            // ← severity から正規化
  "suggestedContext": "Observable movements detected...", // ← context から正規化
  "confidence": 0.9
}
```

**UI 表示**:
- 種類: "運動性" (`suggestedType: "motor"` を使用)
- 強度: "2 - 軽度" (`suggestedSeverity: 2` を使用)
- 信頼度: 0.9 (`confidence` を使用)
- 状況: "Observable movements detected..." (`suggestedContext` を使用)
- ❌ 症状名: 表示されない（`primaryTic` が存在しないため）
- ❌ 複雑性: 表示されない（`primaryTic` が存在しないため）

---

## 新フォーマットデータの場合（Phase 0 デプロイ後）

**DynamoDB レコード**:
```json
{
  "episodeId": "NEW_EPISODE_ID",
  "originalAILabel": {
    "primaryTic": {
      "type": "motor",
      "complexity": "simple",
      "symptomId": "motor_simple_eye_blinking",
      "confidence": 0.95
    },
    "severity": 3,
    "observations": [...]
  }
}
```

**正規化後（UI に渡される）**:
```json
{
  "episodeId": "NEW_EPISODE_ID",
  "primaryTic": {
    "type": "motor",
    "complexity": "simple",
    "symptomId": "motor_simple_eye_blinking",
    "confidence": 0.95
  },
  "severity": 3,
  "observations": [...],
  "suggestedType": undefined,     // primaryTic が優先されるため不要
  "suggestedSeverity": 3,         // severity から設定
  "confidence": 0.95              // primaryTic.confidence から設定
}
```

**UI 表示**:
- ✅ 症状名: "Eye blinking" (`primaryTic.symptomId` から取得)
- ✅ 複雑性: "単純" (`primaryTic.complexity` から取得)
- ✅ 種類: "運動性" (`primaryTic.type` を使用)
- ✅ 強度: "3 - 中度" (`severity` を使用)
- ✅ 信頼度: 0.95 (`primaryTic.confidence` を使用)
- ✅ 観察内容: タイムスタンプ付きリスト

---

## 利点

### 1. 即座に既存データが表示される
- Phase 0 のデプロイを待たずに、既存の旧データが UI に反映される
- ユーザーは「データがない」と誤解しない

### 2. 新旧フォーマットの共存
- 新しいデータ（`primaryTic` ベース）と古いデータが混在しても動作する
- 段階的な移行が可能

### 3. 一貫性の保証
- Frontend と Backend の両方で正規化
- 初回表示とポーリング更新で同じデータ形式

### 4. 型安全性
- TypeScript で両フォーマットを許容
- コンパイルエラーなし

---

## 今後の方向性

### 短期（Phase 0-1 デプロイ後）
1. ✅ **正規化レイヤーの維持**
   - 既存データのために必要
   - 新しいデータは `primaryTic` ベースで保存される

2. ⏳ **新データの検証**
   - Phase 0 デプロイ後、新規分析が `primaryTic` を含むか確認
   - UI で症状名・複雑性が表示されることを確認

### 中期（1-2週間後）
3. 📋 **旧データの再分析**
   - 既存の旧フォーマットエピソードを再分析
   - 新フォーマットで上書き

4. 📋 **フォールバックロジックの簡素化**
   - 全データが新フォーマットになったら、旧フィールドへのフォールバックを削除可能
   - ただし型定義は残す（防御的プログラミング）

### 長期（1ヶ月後）
5. 📋 **旧フィールドの非推奨化**
   - コメントで `@deprecated` マーク
   - 新しいコードでは使用しない

6. 📋 **最終的な削除（オプション）**
   - 全データが確実に新フォーマットになったら、旧フィールドを型定義から削除
   - ただし、防御的に残しておく方が安全

---

## テスト

### 手動テスト
1. **旧データの表示確認**
   - ブラウザで既存のエピソード（`01KKADKBTN8QZ3EEVAZ3NG7775`）を開く
   - 「運動性」「強度 2/5」が表示されることを確認
   - Console ログで `suggestedType: "motor"` を確認

2. **新データの表示確認（Phase 0 後）**
   - 新しい動画を分析
   - 症状名・複雑性が表示されることを確認

### 自動テスト（TODO）
- `timeline-day-group.test.tsx` で旧フォーマット正規化をテスト
- API テストで Backend 正規化をテスト

---

## まとめ

**現状**: 既存の旧データが UI に表示されるようになった ✅

**次**: Phase 0-1 をデプロイして、新データが `primaryTic` ベースで保存されることを確認 ⏳

**将来**: 全データを新フォーマットに移行したら、正規化レイヤーを簡素化 📋
