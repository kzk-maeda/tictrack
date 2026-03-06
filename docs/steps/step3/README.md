# Step 3: 動画キャプチャ + アップロード

> **日程**: Day 6-9
> **前提**: Step 2 完了（チックカード + エピソード記録）
> **マスタードキュメント**: [`architecture_final.md`](../../design/architecture_final.md) §4.4, §7, §5.2 / [`implementation_roadmap.md`](../../design/implementation_roadmap.md)

---

## 目標

動画撮影 → アップロード → エピソードと連携 → タイムラインで再生。

---

## 前提条件

- Step 2 の TicCards + Episodes CRUD が完了
- S3 media バケットが作成済み（`amplify/storage/resource.ts`）

---

## 成果物

### バックエンド

| ファイル | 内容 |
|---------|------|
| `amplify/functions/api-handler/routes/upload.ts` | Presigned URL 発行 |
| `amplify/functions/api-handler/routes/episodes.ts` | 動画メタデータ統合（拡張） |

### フロントエンド

| ファイル | 内容 |
|---------|------|
| `src/app/capture/page.tsx` | 動画キャプチャ画面 |
| `src/components/capture/VideoRecorder.tsx` | MediaRecorder コンポーネント |
| `src/components/capture/VideoPreview.tsx` | プレビュー + 確認 |
| `src/components/capture/UploadProgress.tsx` | アップロード進捗表示 |
| `src/components/timeline/VideoThumbnail.tsx` | タイムラインのサムネイル |
| `src/lib/media.ts` | MediaRecorder ヘルパー |
| `src/lib/upload.ts` | S3 アップロードヘルパー |

---

## API エンドポイント

> 参照: `architecture_final.md` §5.2, §7.2

### Presigned URL 発行

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/children/{childId}/episodes/{episodeId}/upload-url` | S3 presigned URL 発行 |

### リクエスト/レスポンス

**POST `/children/{childId}/episodes/{episodeId}/upload-url`**:
```json
{
  "contentType": "video/mp4",
  "fileSize": 5000000
}
```

**レスポンス**:
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "s3Key": "videos/{userId}/{childId}/{episodeId}/original.mp4"
}
```

---

## 動画キャプチャ UX フロー

> 参照: `architecture_final.md` §4.4

```
1. 「記録」ボタンタップ → 選択: [新規/不明 → 動画撮影] or [既出チック → ワンタップ]
2. カメラ起動（MediaRecorder API）
3. MIME タイプ自動検出:
   - iOS Safari: video/mp4 (H.264)
   - Chrome/Android: video/webm (VP8/VP9)
4. 録画（10〜20秒、カウントダウン表示）
   - videoBitsPerSecond: 1.5Mbps（720p 程度）
5. プレビュー → 「保存」or「撮り直し」
6. Episode 作成（recordType: "video"）
7. Presigned URL 取得 → S3 直接アップロード（進捗表示）
8. uploadStatus: "completed" に更新
```

### フォールバック

MediaRecorder 非対応環境（iOS 14.4 以前）では:
```html
<input type="file" accept="video/*" capture="environment">
```

---

## 作業内容

### 1. MediaRecorder 動画キャプチャ

- `MediaRecorder.isTypeSupported()` で MIME タイプ検出
- 10〜20 秒タイマー（カウントダウン表示）
- `videoBitsPerSecond: 1_500_000`（720p 相当）
- 20 秒上限で自動停止
- プレビュー画面で確認/撮り直し

### 2. Presigned URL API

- Content-Type 制限: `video/mp4` と `video/webm` のみ
- ファイルサイズ上限: 50MB
- 有効期限: 5 分
- S3 キー: `videos/{userId}/{childId}/{episodeId}/original.{ext}`

### 3. S3 直接アップロード

- XHR `progress` イベントでアップロード進捗表示
- 完了後に Episode の `uploadStatus` を `completed` に更新
- 動画メタデータを Episode に統合:
  - `videoS3Key`, `videoMimeType`, `videoFileSize`, `videoDuration`

### 4. 動画再生

- 再生用 Presigned URL（GET 用）取得: 有効期限 60 分
- タイムラインにサムネイル表示

---

## TDD テスト項目

- [ ] Presigned URL 生成 API が `url`（PUT用）と `s3Key` を返すこと
- [ ] Presigned URL の有効期限が 5 分以内であること
- [ ] Content-Type 制限: `video/mp4` と `video/webm` のみ許可、それ以外は拒否されること
- [ ] 50MB 超のファイルに対して Presigned URL が拒否されること
- [ ] S3 アップロード完了後に Episode の `uploadStatus` が `completed` に更新されること
- [ ] Episode と動画が `episodeId` で正しく紐づいていること（`videoS3Key` が設定されること）
- [ ] 動画再生用 Presigned URL（GET用）が取得でき、有効期限が 60 分であること
- [ ] タイマーが 10 秒後に自動停止すること（MediaRecorder の `stop()` が呼ばれること）
- [ ] 20 秒の上限に達した場合に録画が自動停止すること
- [ ] `videoDuration` が実際の録画時間（秒）と一致すること
- [ ] MediaRecorder 非対応環境で `<input type="file">` フォールバックが表示されること

---

## 完了基準

- カメラ起動 → 10 秒動画撮影 → S3 にアップロード → タイムラインで動画を再生 が動作する
- 全 TDD テスト項目が Green

---

## リスク

| リスク | 対策 |
|--------|------|
| iOS Safari MediaRecorder 非対応 | Step 3 初日に検証。非対応なら `<input type="file" capture>` フォールバック |

---

## 次のステップ

→ [Step 4: AI ラベリング基本](../step4/README.md)
