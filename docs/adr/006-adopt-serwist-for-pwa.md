# ADR 006: Serwist を PWA に採用

## ステータス

承認済み（2026-03-06）

## 背景

PWA（Progressive Web App）機能を実装するため以下を検討：

### 選択肢 1: next-pwa
- Next.js 向けの PWA プラグイン
- Workbox ベース
- 2021 年からメンテナンス停止

### 選択肢 2: Serwist
- next-pwa の後継
- 活発にメンテナンスされている
- Next.js 14+ App Router 完全対応
- TypeScript ファースト

### 問題点
- オフライン対応が重要（医療記録の信頼性）
- Next.js 14 App Router を使用
- メンテナンスされていないライブラリは避けたい

## 決定

**Serwist を PWA 実装に採用する。**

理由：
1. **活発なメンテナンス**: 最新の Next.js に対応
2. **App Router 対応**: Next.js 14+ の新機能に完全対応
3. **TypeScript サポート**: 型安全な設定
4. **後継プロジェクト**: next-pwa の作者が推奨

## 結果

### ポジティブ
- ✅ Next.js 14 App Router で動作確認済み
- ✅ TypeScript で設定を記述、型安全性確保
- ✅ 定期的なアップデートあり
- ✅ オフライン対応が安定動作

### ネガティブ
- ❌ next-pwa からの移行が必要（破壊的変更あり）
- ❌ ドキュメントが英語のみ
- ❌ コミュニティが next-pwa より小さい

### トレードオフ
- **成熟度** vs **メンテナンス性** → メンテナンス性を優先
- **コミュニティサイズ** vs **最新対応** → 最新対応を優先

## 実装パターン

```javascript
// next.config.js
const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

module.exports = withSerwist({ /* next config */ });
```

## 関連 ADR

なし
