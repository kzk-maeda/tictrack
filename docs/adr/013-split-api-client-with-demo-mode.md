# ADR 013: API Client のモジュール分割とデモモード分離

## ステータス

承認済み（2026-03-12）

## 背景

フロントエンドの API Client が単一ファイル（`src/lib/api.ts`、343行）にすべての機能が集約されている状態：

### 現状の問題点

1. **責務の混在**: 認証クライアント、デモモードクライアント、API関数群がすべて1ファイルに混在
2. **モード切り替えロジックの分散**: `isDemoMode()` チェックが `apiClient` 関数内に直書き
3. **型定義の散在**: 各API関数の型定義が同じファイルに混在（343行）
4. **テストの困難さ**: 単一ファイルで複数の責務をテストする必要がある
5. **保守性の低下**: 新しいAPI追加時に長大なファイルを編集する必要がある
6. **import の肥大化**: すべてを `@/lib/api` からインポートするため、必要な関数だけをインポートできない

### 例: `src/lib/api.ts` の構造（旧）

```typescript
// 343行のファイルに以下が混在:
- apiClient() 関数（認証 + デモモード判定）
- getAuthToken()
- isDemoMode()
- triggerAIAnalysis(), getAILabel(), ... (AI Label API)
- listMedicationCards(), createMedicationCard(), ... (Medication API)
- listLifeEvents(), createLifeEvent(), ... (Life Events API)
- 各APIの型定義 (Request/Response)
```

### デモモード実装の問題点

ADR 010（デモモード実装）で決定した通り、デモモードはフロントエンドで以下を実装：

1. localStorage による `isDemoMode` 管理
2. 認証スキップ（`fetchAuthSession` を呼ばない）
3. `/demo/*` プレフィックス付きURL
4. 変更操作（POST/PUT/DELETE）のブロック

しかし、これらのロジックが単一の `apiClient()` 関数内に if 分岐で実装されており、テストや保守が困難。

### 選択肢

#### 選択肢 1: 現状維持（単一ファイル）
- メリット: シンプル、変更不要
- デメリット: 保守困難、テスト困難、責務不明確

#### 選択肢 2: 機能別ファイル分割のみ（デモモード分離なし）
- メリット: ファイルサイズ削減、機能ごとに整理
- デメリット: デモモードロジックが各ファイルに分散、認証クライアントとデモクライアントが混在

#### 選択肢 3: クライアント分離 + 機能別モジュール分割
- メリット: 責務明確、テスト容易、保守性向上、Tree-shaking 可能
- デメリット: ディレクトリ構造が複雑化

## 決定

**`src/lib/api/` ディレクトリを作成し、クライアント層と機能層を分離する。**

### アーキテクチャ

```
src/lib/api/
├── index.ts              # エントリポイント（モード検出 + ルーティング）
├── client.ts             # 認証付きクライアント
├── demo-client.ts        # デモモード専用クライアント
├── ai-labels.ts          # AI Label API関数群
├── medications.ts        # Medication API関数群 + 型定義
├── life-events.ts        # Life Events API関数群
└── __tests__/
    ├── client.test.ts
    └── demo-client.test.ts
```

### レイヤー分離

#### Layer 1: クライアント層（認証 + HTTP）
- `client.ts`: AWS Amplify `fetchAuthSession` を使った認証付きクライアント
- `demo-client.ts`: 認証不要、読み取り専用、`/demo/*` プレフィックス

#### Layer 2: ルーティング層（モード検出）
- `index.ts`: `localStorage` の `isDemoMode` を読み取り、適切なクライアントに委譲
- `apiClient<T>(path, options)` を再エクスポート（後方互換性）

#### Layer 3: 機能層（ドメイン API）
- `ai-labels.ts`: AI分析関連のAPI関数（triggerAIAnalysis, getAILabel, etc.）
- `medications.ts`: 服薬管理関連のAPI関数 + 型定義
- `life-events.ts`: ライフイベント関連のAPI関数

### 理由

1. **単一責任原則**: 各ファイルが単一の責務を持つ（認証、デモモード、API機能）
2. **テスト容易性**: クライアント層（client, demo-client）を独立してテスト可能
3. **再利用性**: 機能別にインポート可能（`@/lib/api/medications` から必要な関数のみ）
4. **Tree-shaking**: 使用していない API 関数がバンドルに含まれない
5. **保守性**: 新しいAPI追加時に対応するモジュールのみを編集

## 結果

### ポジティブ

- ✅ **クライアント層の分離**: 認証クライアントとデモクライアントが完全に独立（24個の専用テスト追加）
- ✅ **ファイルサイズ削減**: 343行の単一ファイル → 7ファイル（最大139行、平均60行）
- ✅ **テストカバレッジ向上**: 認証フロー、デモモードブロック、エラーハンドリングを個別にテスト
- ✅ **型安全性の向上**: 各機能の型定義が近接配置（medications.ts に MedicationCardResponse 等）
- ✅ **import の明確化**: 必要な機能のみをインポート（`@/lib/api/medications` から特定関数）
- ✅ **Tree-shaking 対応**: 未使用の API 関数がバンドルに含まれない

### ネガティブ

- ❌ **ディレクトリ構造の複雑化**: `src/lib/api.ts` → `src/lib/api/*.ts` （7ファイル）
- ❌ **import パスの変更**: 既存のインポート文を更新する必要がある（8ファイル更新）
- ❌ **学習コスト**: 新規参加者がディレクトリ構造を理解する必要がある

### トレードオフ

- **シンプルさ** vs **保守性/テスト容易性** → プロトタイプから本番移行を見据えて保守性を優先
- **単一ファイル** vs **モジュール分割** → 将来的な機能追加を考慮してモジュール分割を選択
- **後方互換性** vs **完全な書き換え** → `index.ts` で `apiClient` を再エクスポートして既存コードへの影響を最小化

## 実装パターン

### 1. クライアント層の実装

#### client.ts（認証付きクライアント）

```typescript
import { fetchAuthSession } from "aws-amplify/auth";

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function client<T>(
  apiEndpoint: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAuthToken();
  const url = `${apiEndpoint}${path}`; // NO /demo prefix

  const headers = {
    "Content-Type": "application/json",
    Authorization: token,
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Error handling...
  if (!response.ok) throw new ApiError(response.status, error);
  if (response.status === 204) return undefined as T;
  return response.json();
}
```

#### demo-client.ts（デモモード専用クライアント）

```typescript
export async function demoClient<T>(
  apiEndpoint: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";

  // Block mutations in demo mode
  if (method !== "GET") {
    throw new ApiError(403, {
      type: "demo-mode-mutation",
      status: 403,
      detail: "Mutations are not allowed in demo mode",
    });
  }

  const url = `${apiEndpoint}/demo${path}`; // Add /demo prefix

  const headers = {
    "Content-Type": "application/json",
    // NO Authorization header
  };

  const response = await fetch(url, { method, headers });
  // Error handling...
}
```

### 2. ルーティング層の実装

#### index.ts（モード検出 + クライアント選択）

```typescript
import { client } from "./client";
import { demoClient } from "./demo-client";

function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isDemoMode") === "true";
}

export async function apiClient<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const isDemo = isDemoMode();

  if (isDemo) {
    return demoClient<T>(API_ENDPOINT, path, options);
  } else {
    return client<T>(API_ENDPOINT, path, options);
  }
}

// Re-export ApiError for convenience
export { ApiError } from "./client";
```

### 3. 機能層の実装

#### medications.ts（Medication API + 型定義）

```typescript
import { apiClient } from "./index";

// Types
export interface CreateMedicationCardRequest {
  medicationName: string;
  medicationType: "antipsychotic" | "alpha2_agonist" | "other";
  dosageMg: number;
  frequency?: string;
  notes?: string;
  isActive?: boolean;
}

export interface MedicationCardResponse {
  medicationId: string;
  childId: string;
  medicationName: string;
  medicationType: "antipsychotic" | "alpha2_agonist" | "other";
  dosageMg: number;
  frequency?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// API Functions
export async function listMedicationCards(
  childId: string
): Promise<MedicationCardResponse[]> {
  return apiClient<MedicationCardResponse[]>(
    `/children/${childId}/medications`
  );
}

export async function createMedicationCard(
  childId: string,
  request: CreateMedicationCardRequest
): Promise<MedicationCardResponse> {
  return apiClient<MedicationCardResponse>(
    `/children/${childId}/medications`,
    { method: "POST", body: request }
  );
}

// ... other functions
```

### 4. インポートパターン

#### 既存コード（apiClient のみ使用）

```typescript
// 変更不要（index.ts で再エクスポート）
import { apiClient } from "@/lib/api";

const data = await apiClient<Child[]>("/children");
```

#### 新規コード（特定 API 関数を使用）

```typescript
// 機能モジュールから直接インポート
import { listMedicationCards, type MedicationCardResponse } from "@/lib/api/medications";

const medications = await listMedicationCards(childId);
```

### 5. テストパターン

#### クライアント層のテスト

```typescript
// __tests__/client.test.ts
import { vi } from "vitest";
import { client } from "../client";

vi.mock("aws-amplify/auth");

test("should include Authorization header", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: "test" }),
  });
  global.fetch = mockFetch;

  await client("https://api.example.com", "/test");

  expect(mockFetch).toHaveBeenCalledWith(
    "https://api.example.com/test",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: expect.any(String),
      }),
    })
  );
});
```

```typescript
// __tests__/demo-client.test.ts
import { demoClient } from "../demo-client";

test("should throw 403 for POST requests", async () => {
  await expect(
    demoClient("https://api.example.com", "/test", { method: "POST" })
  ).rejects.toThrow("Mutations are not allowed in demo mode");
});

test("should add /demo prefix to URL", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: "test" }),
  });
  global.fetch = mockFetch;

  await demoClient("https://api.example.com", "/children");

  expect(mockFetch).toHaveBeenCalledWith(
    "https://api.example.com/demo/children",
    expect.any(Object)
  );
});
```

## マイグレーション手順

### Phase 1: 新規ファイル作成（完了）
1. ✅ `client.ts`, `demo-client.ts`, `index.ts` を作成
2. ✅ 機能別モジュール（`ai-labels.ts`, `medications.ts`, `life-events.ts`）を作成
3. ✅ テストファイル（`client.test.ts`, `demo-client.test.ts`）を作成

### Phase 2: import 更新（完了）
1. ✅ `apiClient` のみ使用しているファイル → 変更不要（8ファイル）
2. ✅ 特定 API 関数を使用しているファイル → 機能モジュールからインポート（8ファイル更新）
   - `ai-label-section.tsx` → `@/lib/api/ai-labels`
   - `use-medications.ts` → `@/lib/api/medications`
   - `use-life-events.ts` → `@/lib/api/life-events`
   - 他5ファイル

### Phase 3: 旧ファイル削除（完了）
1. ✅ `src/lib/api.ts` を削除（343行削除）

### Phase 4: 検証（完了）
1. ✅ 全テスト合格: 179/179（24個の新規テスト含む）
2. ✅ Lint 合格（警告のみ、エラーなし）
3. ✅ Build 合格

## 設計ルール

### ✅ DO

1. **機能ごとにモジュールを分割する**
   - 関連するAPI関数と型定義を同じファイルに配置
   - 例: `medications.ts` に Medication API + Request/Response 型

2. **クライアント層を直接使わない**
   - `client.ts`, `demo-client.ts` を直接インポートしない
   - `index.ts` の `apiClient` を経由してモード切り替えを行う

3. **型定義を近接配置する**
   - API 関数と同じファイルに Request/Response 型を定義
   - 例: `MedicationCardResponse` を `medications.ts` に配置

4. **TDD でクライアント層をテストする**
   - 認証フロー、デモモードブロック、エラーハンドリングを個別にテスト

5. **後方互換性を保つ**
   - 既存の `import { apiClient } from "@/lib/api"` は引き続き動作

### ❌ DON'T

1. **クライアント層を直接インポートしない**
   - ❌ `import { client } from "@/lib/api/client"`
   - ✅ `import { apiClient } from "@/lib/api"`

2. **index.ts に API 関数を追加しない**
   - ❌ `index.ts` に `listMedications()` を追加
   - ✅ 機能別モジュール（`medications.ts`）に追加

3. **型定義を分散させない**
   - ❌ `src/lib/types.ts` に `MedicationCardResponse` を追加
   - ✅ `medications.ts` に型定義を配置

4. **機能モジュール間で相互依存しない**
   - ❌ `ai-labels.ts` が `medications.ts` をインポート
   - ✅ 共通の型は `src/lib/types.ts` に配置

## ファイル構成

### 実装後のディレクトリ構造

```
src/lib/api/
├── index.ts              (35 lines) - エントリポイント
├── client.ts             (59 lines) - 認証付きクライアント
├── demo-client.ts        (47 lines) - デモモード専用クライアント
├── ai-labels.ts          (88 lines) - AI Label API関数群
├── medications.ts       (139 lines) - Medication API関数群 + 型定義
├── life-events.ts        (35 lines) - Life Events API関数群
└── __tests__/
    ├── client.test.ts    (13 tests) - 認証クライアントテスト
    └── demo-client.test.ts (11 tests) - デモクライアントテスト
```

### 削減されたコード

- **削除**: `src/lib/api.ts` (343 lines)
- **追加**: 7ファイル (403 lines total)
- **差分**: +60 lines（テスト含む）

### コードメトリクス

- **最大ファイルサイズ**: 139行（`medications.ts`）← 旧343行
- **平均ファイルサイズ**: 60行
- **テストカバレッジ**: クライアント層100%（24/24テスト合格）

## 関連 ADR

- [ADR 010: デモモード実装](./010-demo-mode-implementation.md) - デモモードの基本設計
- [ADR 011: SWR による状態管理の統一](./011-adopt-swr-for-state-management.md) - API Client を使用する hooks の設計
- [ADR 012: ドメインサービス層の導入](./012-introduce-domain-service-layer.md) - バックエンドのレイヤー分離（類似パターン）

## 参考資料

- [Module Pattern - JavaScript Design Patterns](https://www.patterns.dev/posts/module-pattern/)
- [Tree Shaking - Webpack Docs](https://webpack.js.org/guides/tree-shaking/)
- [Single Responsibility Principle - Clean Code](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html)
