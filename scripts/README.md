# Demo Data Scripts

デモ用のダミーデータを作成・削除するスクリプト群です。

## スクリプト一覧

- **`demo-data.ts`**: 📋 **データ定義**（チックカード、服薬、出来事など）
- **`config.ts`**: ⚙️ **共通設定**（対象ユーザー、テーブル名など）
- **`seed-demo-data.ts`**: ➕ デモデータを作成
- **`cleanup-demo-data.ts`**: 🗑️ デモデータを削除

## 使い方の流れ

```bash
# 1. デモデータを作成
npm run seed:demo

# 2. アプリでテスト・デモ

# 3. データをクリーンアップ
npm run seed:clean

# 4. 必要に応じて再度作成
npm run seed:demo
```

## 作成されるデータ

対象ユーザー: `kzk.maeda0711+test@gmail.com`

### データ内容（2026/01/01 - 2026/03/10）

1. **子供**: 1名（
2. **チックカード**: 10枚
   - Motor tics: 目のまばたき、首のジャーク、肩すくめ、顔面の歪み、物を触る、首を何度も回す
   - Vocal tics: 喉を鳴らす、鼻をすする、咳払い、言葉の繰り返し
3. **症状記録**: 約80件（quick_log）
   - 時間帯は夜（18-22時）に集中
   - コンテキスト: home, school, play, sleep, meal, stress
4. **動画記録**: 3件（AI分析結果付き）
   - 目のまばたき（2026/02/15）
   - 喉を鳴らす（2026/02/20）
   - 肩すくめ（2026/03/05）
5. **服薬カード**: 2枚（2026/01/20以降）
   - リスペリドン 0.5mg（1日2回）
   - グアンファシン 1.0mg（1日1回）
6. **服薬記録**: 約90件（90%の服薬遵守率）
7. **出来事**: 4件
   - 保育園卒園（2026/03/15）
   - 小児神経科の初診（2026/01/15）
   - 発表会（2026/02/10）
   - 妹が生まれる（2026/01/30）

## データのカスタマイズ

すべてのデモデータ定義は **`scripts/demo-data.ts`** に集約されています。

### 例: チックカードを追加

```typescript
// scripts/demo-data.ts
export const TIC_CARDS = [
  // 既存のカード...
  {
    type: "motor" as const,
    complexity: "simple" as const,
    symptomId: "arm_flapping",  // 新しい症状
    severity: 2,
  },
];
```

### 例: 服薬を変更

```typescript
// scripts/demo-data.ts
export const MEDICATIONS = [
  {
    name: "新しい薬",
    type: "antipsychotic" as const,
    dosageMg: 1.0,
    frequency: "1日3回",
    startDate: "2026-02-01",
  },
];
```

### 例: エピソード数を変更

```typescript
// scripts/demo-data.ts
export const EPISODE_SETTINGS = {
  totalQuickLogs: 150,  // 80 → 150 に増やす
  startDate: new Date("2025-12-01"),  // 期間を延ばす
  endDate: new Date("2026-03-10"),
  contexts: ["home", "school", "play", "sleep", "meal", "stress"] as const,
};
```

データ定義を変更したら、再度 `npm run seed:demo` を実行するだけでOKです。

## 事前準備

### 1. AWS認証情報を設定

```bash
# AWS SSOログイン（書き込み権限のあるプロファイルを使用）
aws sso login --profile tictrack-dev

# または環境変数で設定
export AWS_PROFILE=tictrack-dev
```

## 実行方法

```bash
npm run seed:demo
```

または直接実行:

```bash
npx tsx scripts/seed-demo-data.ts
```

## 実行結果

成功すると以下のような出力が表示されます:

```
=== TicTrack Demo Data Seed Script ===

Step 1: Verifying table configuration...
Using DynamoDB tables in region: ap-northeast-1
Example table: Children

Step 2: Getting userId from Cognito...
Fetching userId for kzk.maeda0711+test@gmail.com...
✓ Found userId: abc123...

Step 3: Creating child...
✓ Created child: def456...

Step 4: Creating tic cards...
✓ Created 10 tic cards

Step 5: Creating episodes...
✓ Created 80 episodes

Step 6: Creating video episodes...
✓ Created 3 video episodes with AI labels

Step 7: Creating medication cards...
✓ Created 2 medication cards

Step 8: Creating medication logs...
✓ Created 90 medication logs

Step 9: Creating life events...
✓ Created 4 life events

=== ✓ Demo data seeding completed successfully! ===

Child ID: def456...
User ID: abc123...
Target Email: kzk.maeda0711+test@gmail.com
```

## 注意事項

1. **既存データの削除**: このスクリプトは既存のデータを削除しません。重複を避けるため、事前に対象ユーザーのデータを削除することを推奨します。

2. **動画ファイル**: 動画episodeは作成されますが、実際の動画ファイルはS3にアップロードされません（`s3Key`のみ設定）。実際に動画を再生したい場合は、別途動画ファイルをS3にアップロードしてください。

3. **実行時間**: スクリプトの実行には約30秒〜1分程度かかります。

4. **複数回実行**: 複数回実行すると、同じユーザーに対して複数の子供・データが作成されます。

## トラブルシューティング

### エラー: "User not found in Cognito User Pool"

対象ユーザー (`kzk.maeda0711+test@gmail.com`) がCognito User Poolに登録されていることを確認してください。

### エラー: "NoCredentials" or "Access Denied"

AWS認証情報が正しく設定されているか、書き込み権限があるか確認してください:

```bash
aws sts get-caller-identity --profile tictrack-dev
```

### エラー: "ResourceNotFoundException"

指定したリージョンにテーブルが存在するか確認してください:

```bash
aws dynamodb list-tables --region ap-northeast-1 --profile tictrack-dev
```

## データの確認

### DynamoDBで確認

```bash
# Children テーブルを確認
aws dynamodb scan --table-name "amplify-awsaideascompetition-...-Children" \
  --region ap-northeast-1 --profile tictrack-dev

# Episodes テーブルを確認
aws dynamodb query --table-name "amplify-awsaideascompetition-...-Episodes" \
  --index-name "childId-occurredAt-index" \
  --key-condition-expression "childId = :childId" \
  --expression-attribute-values '{":childId":{"S":"<child-id>"}}' \
  --region ap-northeast-1 --profile tictrack-dev
```

### アプリで確認

1. `kzk.maeda0711+test@gmail.com` でログイン
2. タイムラインページで記録を確認
3. ダッシュボードで統計を確認
4. イベントページで各種データを確認

## データのクリーンアップ

対象ユーザーのすべてのデータを削除するスクリプトを用意しています。

### クリーンアップの実行

```bash
npm run seed:clean
```

または直接実行:

```bash
npx tsx scripts/cleanup-demo-data.ts
```

### クリーンアップされるデータ

対象ユーザー (`kzk.maeda0711+test@gmail.com`) のすべてのデータ:
1. すべての子供レコード
2. 各子供に紐づく以下のデータ:
   - チックカード
   - 症状記録（Episodes）
   - AI分析結果（AILabels）
   - 服薬カード
   - 服薬記録
   - 出来事（LifeEvents）

### 実行結果例

```
=== TicTrack Demo Data Cleanup Script ===

Step 1: Getting userId from Cognito...
✓ Found userId: abc123...

Step 2: Getting children...
✓ Found 1 children

Step 3: Deleting child data...

Deleting data for child: def456...
  ✓ Deleted 10 tic cards
  Found 83 episodes
  ✓ Deleted 3 AI labels
  ✓ Deleted 83 episodes
  ✓ Deleted 90 medication logs
  ✓ Deleted 2 medication cards
  ✓ Deleted 4 life events
  ✓ Deleted child record

=== ✓ Demo data cleanup completed successfully! ===

Deleted data for 1 child(ren)
User ID: abc123...
Target Email: kzk.maeda0711+test@gmail.com
```

### 注意事項

- **完全削除**: このスクリプトは対象ユーザーのすべてのデータを完全に削除します。元に戻すことはできません。
- **冪等性**: 複数回実行しても安全です。データが存在しない場合は何も削除されません。
- **対象ユーザー**: `scripts/config.ts` の `TARGET_EMAIL` で指定されたユーザーのみが対象です。
