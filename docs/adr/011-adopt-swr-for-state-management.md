# ADR 011: SWR をフロントエンド状態管理に採用

## ステータス

承認済み（2026-03-12）

## 背景

データフェッチフックが手動実装（useState + useEffect）と SWR で混在している状態：

### 現状
- `use-children.ts`: useState + useEffect（キャッシュなし）
- `use-tic-cards.ts`: useState + useEffect（キャッシュなし）
- `use-episodes.ts`: useState + useEffect（キャッシュなし）
- `use-medications.ts`: useState + useEffect（キャッシュなし）
- `use-life-events.ts`: useState + useEffect（キャッシュなし）
- `use-dashboard.ts`: SWR（30秒キャッシュ、自動再検証あり）

### 問題点
1. **キャッシュ共有なし**: 同じデータを複数コンポーネントで取得
2. **手動リフレッシュ**: フォーカス復帰時やネットワーク復帰時に古いデータ
3. **実装パターン不統一**: メンテナンス性低下
4. **Optimistic Update なし**: ミューテーション後の UI 更新が遅い

### 選択肢

#### 選択肢 1: 現状維持（手動実装）
- メリット: シンプル、依存なし
- デメリット: キャッシュなし、自動再検証なし

#### 選択肢 2: React Query
- メリット: 豊富な機能、大規模コミュニティ
- デメリット: バンドルサイズ大、設定複雑

#### 選択肢 3: SWR
- メリット: 軽量（5KB）、シンプル API、既に使用中
- デメリット: React Query より機能少ない

## 決定

**全データフェッチフックを SWR に統一する。**

理由：
1. **既に導入済み**: use-dashboard.ts で実績あり
2. **軽量**: バンドルサイズ 5KB（React Query は 40KB+）
3. **シンプル API**: 学習コスト低、保守しやすい
4. **十分な機能**: キャッシュ、再検証、Optimistic Update が可能
5. **Vercel 製**: Next.js との相性良好

## 結果

### ポジティブ
- ✅ キャッシュ共有により重複リクエスト削減
- ✅ Optimistic Update でユーザー体験向上
- ✅ フォーカス復帰時に自動で最新データ取得
- ✅ 実装パターン統一、保守性向上
- ✅ 既存コンポーネント変更不要（戻り値インターフェース維持）

### ネガティブ
- ❌ React Query と比較して機能が少ない（無限スクロール等）
- ❌ 既存フックの書き換えコスト

### トレードオフ
- **機能豊富さ** vs **シンプルさ** → プロトタイプではシンプルさを優先
- **バンドルサイズ** vs **機能** → 5KB で十分な機能を提供

## 実装パターン

### 基本的な使い方

```typescript
import useSWR from "swr";
import { useCallback } from "react";
import { apiClient } from "@/lib/api";

export function useChildren() {
  const { data, error, isLoading, mutate } = useSWR<Child[]>(
    "/children",
    async (url) => apiClient<Child[]>(url),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const children = data || [];

  const createChild = useCallback(
    async (data: CreateChildRequest) => {
      const child = await apiClient<Child>("/children", {
        method: "POST",
        body: data,
      });

      // Optimistic update
      await mutate([...children, child], false);

      return child;
    },
    [children, mutate],
  );

  return { children, isLoading, error, createChild };
}
```

### Conditional Fetching（childId 依存）

```typescript
export function useTicCards(childId: string | null) {
  const url = childId ? `/children/${childId}/tic-cards` : null;

  const { data, error, isLoading, mutate } = useSWR<TicCard[]>(
    url, // null の場合はフェッチしない
    async (url) => apiClient<TicCard[]>(url),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const ticCards = data || [];
  // ...
}
```

### Optimistic Update パターン

```typescript
const updateChild = useCallback(
  async (childId: string, data: UpdateChildRequest) => {
    const updated = await apiClient<Child>(`/children/${childId}`, {
      method: "PUT",
      body: data,
    });

    // Optimistic update: 即座に UI に反映
    await mutate(
      children.map((c) => (c.childId === childId ? updated : c)),
      false // revalidate しない（サーバーレスポンスを信頼）
    );

    return updated;
  },
  [children, mutate],
);
```

## 設計ルール

今後のフロントエンド開発では以下のルールに従う：

### ✅ DO
1. **データフェッチは SWR を使用する**
   - useState + useEffect の手動実装は禁止

2. **Optimistic Update を実装する**
   - ミューテーション後は `mutate()` で即座に UI 更新

3. **Conditional Fetching を活用する**
   - パラメータ未定義時は `null` を渡してフェッチを抑制

4. **戻り値インターフェースを統一する**
   - `{ data, isLoading, error, mutations... }` の形式
   - コンポーネントから見たインターフェースを維持

5. **適切なキャッシュ設定**
   - `revalidateOnFocus: true` (デフォルト推奨)
   - `dedupingInterval: 5000` (5秒間は重複リクエスト抑制)

### ❌ DON'T
1. **useState + useEffect で手動実装しない**
   - キャッシュなし、再検証なしは UX 低下

2. **過度な revalidation を避ける**
   - `revalidateOnMount: false` は慎重に使用

3. **mutate を忘れない**
   - ミューテーション後は必ず `mutate()` を呼ぶ

## 関連 ADR

なし

## 参考資料

- [SWR 公式ドキュメント](https://swr.vercel.app/)
- [Optimistic Updates](https://swr.vercel.app/docs/mutation#optimistic-updates)
- [Conditional Fetching](https://swr.vercel.app/docs/conditional-fetching)
