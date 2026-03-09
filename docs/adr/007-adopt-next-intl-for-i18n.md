# ADR 007: next-intl を i18n に採用

## ステータス

承認済み（2026-03-08）

## 背景

多言語対応（日本語 + 英語）を実装するため以下を検討：

### 選択肢 1: react-i18next
- React 標準の i18n ライブラリ
- 汎用的で広く使われている
- Next.js 14 App Router との統合が複雑

### 選択肢 2: next-intl
- Next.js 公式推奨
- App Router ネイティブ対応
- SSR 完全対応
- TypeScript サポート

### 問題点
- Next.js 14 App Router を使用
- SSR でも動作する必要がある
- デフォルト言語は日本語
- Cookie ベースで言語切り替え

## 決定

**next-intl を i18n 実装に採用する。**

理由：
1. **Next.js 公式推奨**: App Router との統合が完璧
2. **SSR 対応**: Server Components でも動作
3. **TypeScript サポート**: 型安全な翻訳キー
4. **ICU メッセージフォーマット**: 複数形対応
5. **軽量**: ~15KB gzipped

## 結果

### ポジティブ
- ✅ Next.js 14 App Router でシームレスに動作
- ✅ Server/Client Components 両方で使用可能
- ✅ TypeScript で翻訳キーの補完が効く
- ✅ 複数形・日付フォーマットが簡単
- ✅ Middleware で locale 検出・Cookie 管理

### ネガティブ
- ❌ Next.js 専用（他フレームワークで使えない）
- ❌ react-i18next より学習リソースが少ない

### トレードオフ
- **汎用性** vs **Next.js 最適化** → Next.js 最適化を優先
- **エコシステム** vs **公式サポート** → 公式サポートを優先

## 実装パターン

```typescript
// Server Component
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations('featureName');
  return <h1>{t('title')}</h1>;
}

// Client Component
"use client";
import { useTranslations } from "next-intl";

export function Component() {
  const t = useTranslations('featureName');
  return <button>{t('buttonLabel')}</button>;
}
```

## 翻訳ファイル構造

```
/messages
  /ja.json  # 日本語（デフォルト）
  /en.json  # 英語
```

Feature 単位で整理：
- `common`: 共通文字列
- `auth`: 認証
- `nav`: ナビゲーション
- `children`: 子ども管理
- `ticCards`: チックカード
- `timeline`: タイムライン
- `aiLabel`: AI 分析結果

## 関連 ADR

なし
