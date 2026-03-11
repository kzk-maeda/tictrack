# ADR 010: デモモードの実装（認証不要の体験機能）

## ステータス

承認済み（2026-03-12）

## 背景

AWS 10,000 AIdeas Competition のセミファイナリストとして、審査員やユーザーがアプリを簡単に体験できる必要がある。

### 課題
- サインアップの障壁：審査員がアカウント作成なしでアプリを試せない
- デモデータの提示：機能を理解してもらうには実データが必要
- セキュリティ：認証なしでデータアクセスを許可する必要がある
- 開発期間：プロトタイプ期限（2026/3/13）まで 2 日

### 検討した選択肢

#### 選択肢 1: テストアカウント + 自動ログイン
- 固定のテストアカウントを作成
- URL パラメータでトークンを渡して自動ログイン
- **問題点**: Cognito セキュリティ制約、トークンの有効期限管理

#### 選択肢 2: サーバーサイド専用デモページ
- `/demo` 専用の SSR ページを作成
- API 呼び出しをサーバー側で実行
- **問題点**: SPA の利点が失われる、開発コスト大

#### 選択肢 3: 認証なし API + 専用ルート
- `/demo/*` ルートを認証なしで公開
- 固定デモユーザー ID で既存 API ロジックを再利用
- **利点**: 既存コンポーネント再利用、開発速度、保守性

## 決定

**選択肢 3: 認証なし API + 専用ルート を採用する。**

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                     │
├─────────────────────────────────────────────────────────────┤
│ /auth                                                        │
│   └─ "Demo Mode" Button                                     │
│       ├─ localStorage.setItem("isDemoMode", "true")         │
│       └─ router.push("/demo/timeline")                      │
│                                                              │
│ /demo/* Pages (timeline, events, dashboard, settings)       │
│   ├─ No authentication required                             │
│   ├─ Demo banner visible                                    │
│   ├─ Edit/Delete buttons hidden (read-only UI)              │
│   └─ Reuse existing page components                         │
│                                                              │
│ Nav Component                                                │
│   ├─ Detect: pathname.startsWith("/demo")                   │
│   ├─ Links: /demo/timeline, /demo/events, etc.              │
│   └─ Hide: Record Video, Logout buttons                     │
│                                                              │
│ API Client (src/lib/api.ts)                                 │
│   ├─ Check: localStorage.getItem("isDemoMode")              │
│   ├─ Prefix: /demo + path                                   │
│   ├─ Skip: Authorization header                             │
│   └─ Block: POST/PUT/DELETE requests                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend API                                                  │
├─────────────────────────────────────────────────────────────┤
│ API Gateway                                                  │
│   ├─ /demo/{proxy+} (AuthorizationType: NONE)               │
│   └─ /{proxy+} (Cognito Authorizer)                         │
│                                                              │
│ Lambda Router                                                │
│   ├─ Demo Routes (demo.ts)                                  │
│   │   ├─ GET /demo/children → demoListChildren()            │
│   │   ├─ GET /demo/children/:id/episodes → ...              │
│   │   └─ POST/PUT/DELETE /demo/* → rejectMutation()         │
│   │                                                          │
│   └─ Auth Routes (existing handlers)                        │
│                                                              │
│ Demo Router (routes/demo.ts)                                │
│   ├─ getDemoUserId() → process.env.DEMO_USER_ID             │
│   ├─ createDemoEvent(event) → inject demo userId            │
│   └─ Wrapper functions:                                     │
│       ├─ demoListChildren(event)                            │
│       │   └─ listChildren(createDemoEvent(event))           │
│       └─ ... (reuse existing handlers)                      │
│                                                              │
│ DynamoDB                                                     │
│   └─ Demo user data (seeded via scripts/seed-demo-data.ts)  │
└─────────────────────────────────────────────────────────────┘
```

### 主要な設計決定

1. **URL ベースのデモモード検出**
   - `pathname.startsWith("/demo")` で判定
   - サーバー/クライアント両方で同じ値が得られる（水和エラー回避）
   - React Context 不使用（複雑性削減）

2. **localStorage での永続化**
   - ページリロード時もデモモード維持
   - Context なしで直接読み書き
   - `isDemoMode` キーで管理

3. **既存コンポーネントの再利用**
   - Demo pages は既存ページをインポート
   - `isDemoMode` prop で UI 制御（編集ボタン非表示）
   - コード重複なし

4. **バックエンド: Wrapper Pattern**
   - Demo routes は既存 handler を wrapper で呼び出し
   - `createDemoEvent()` で demo userId を注入
   - ビジネスロジックの重複なし

5. **読み取り専用の強制**
   - Frontend: API client が POST/PUT/DELETE をブロック
   - Backend: `rejectMutation()` が 403 を返す
   - 二重防御でセキュリティ確保

## 結果

### ポジティブ

- ✅ **開発速度**: 1.5 日で実装完了（期限内）
- ✅ **コード再利用**: 既存コンポーネント/ハンドラを 100% 再利用
- ✅ **保守性**: ビジネスロジックは 1 箇所（既存 handlers）のみ
- ✅ **テスタビリティ**: 47 テストケース（バックエンド 8 + フロントエンド 11 + E2E 28）
- ✅ **UX**: サインアップなしでアプリ体験可能
- ✅ **セキュリティ**: 読み取り専用を二重に強制
- ✅ **i18n 対応**: 日本語/英語の翻訳完備
- ✅ **水和エラー回避**: URL ベース検出でサーバー/クライアント一致

### ネガティブ

- ❌ **セキュリティリスク**: デモデータが公開される（意図的だが注意必要）
- ❌ **API エンドポイント増加**: `/demo/*` 専用ルートの追加
- ❌ **デモユーザー管理**: Seed script でデモデータを維持する必要

### トレードオフ

| トレードオフ | 選択 | 理由 |
|-------------|------|------|
| セキュリティ vs アクセシビリティ | アクセシビリティ優先 | コンペティションのデモ用途 |
| コード重複 vs 単純性 | コード再利用優先 | 保守性を重視 |
| React Context vs URL 検出 | URL 検出優先 | 水和エラー回避 |
| Frontend のみ vs Frontend + Backend | 両方で防御 | セキュリティ二重化 |

## 実装の詳細

### ファイル構成

**Backend**:
```
amplify/
├── backend.ts (DEMO_USER_ID 環境変数)
├── custom/api/index.ts (/demo/{proxy+} route)
└── functions/api-handler/
    ├── router.ts (demo routes 定義)
    ├── routes/demo.ts (wrapper functions)
    └── __tests__/demo.test.ts (8 tests)
```

**Frontend**:
```
src/
├── app/
│   ├── auth/page.tsx (Demo Mode button)
│   └── demo/ (timeline, events, dashboard, settings)
├── components/
│   ├── layout/nav.tsx (URL ベース検出)
│   └── */[component].tsx (isDemoMode prop)
├── lib/
│   ├── api.ts (demo prefix + mutation block)
│   └── __tests__/api.demo.test.ts (11 tests)
└── contexts/demo-mode-context.tsx (未使用 - 水和エラーのため削除)
```

**E2E**:
```
e2e/demo-mode.spec.ts (28 tests)
```

### 環境変数

```typescript
// amplify/backend.ts
backend.apiHandler.addEnvironment(
  "DEMO_USER_ID",
  process.env.DEMO_USER_ID || "47644a48-a081-70d1-6e8b-272c764c6078"
);
```

### テストカバレッジ

| カテゴリ | ファイル | テスト数 | 状態 |
|---------|---------|---------|------|
| Backend API | `demo.test.ts` | 8 | ✅ All passing |
| Frontend API | `api.demo.test.ts` | 11 | ✅ All passing |
| E2E | `demo-mode.spec.ts` | 28 | ✅ All passing |
| **合計** | | **47** | **✅** |

## 代替案の評価

### なぜ React Context を使わなかったか

**試行**: 当初 `DemoModeContext` を実装
```typescript
// ❌ 水和エラーが発生
const { isDemoMode } = useDemoMode();
```

**問題**:
- サーバー: `isDemoMode = false` (localStorage アクセス不可)
- クライアント初回: `isDemoMode = false` (useEffect 前)
- クライアント 2 回目: `isDemoMode = true` (useEffect 後)
- 結果: `Error: Hydration failed`

**解決**: URL ベース検出
```typescript
// ✅ サーバー/クライアント同じ値
const isInDemoMode = pathname?.startsWith("/demo");
```

### なぜアーティファクトを使わなかったか（CI）

**当初の設計**:
```yaml
build:
  - npm run build
  - Upload artifact: .next/

e2e:
  - Download artifact: .next/
  - npm run test:e2e
```

**問題**: `Error: Artifact not found for name: nextjs-build`

**解決**: E2E ジョブ内でビルド
```yaml
e2e:
  - npm run build  # 直接ビルド
  - npm run test:e2e
```

## セキュリティ考慮事項

### 公開されるデータ
- デモユーザー: `47644a48-a081-70d1-6e8b-272c764c6078`
- 子ども: Adam (2018-04 生まれ)
- Tic Cards: 10 種類
- Episodes: 80+ 件
- Medications: 2 種類
- Life Events: 4 件

### 保護されるデータ
- ❌ デモモードで変更不可（POST/PUT/DELETE ブロック）
- ❌ 他ユーザーのデータアクセス不可（userId で分離）
- ❌ 本番ユーザーデータへの影響なし

### 監視
- CloudWatch Logs で `/demo/*` アクセスを監視
- 不審なアクセスパターンを検出可能

## 将来の改善

### Phase 2 候補（本番リリース後）
1. **分析機能の追加**
   - デモモード利用率の追跡
   - どの機能が最も使われているか

2. **カスタマイズ可能なデモデータ**
   - 複数の子どもプロファイル
   - 異なる症状パターン

3. **セッション管理**
   - デモセッション ID の発行
   - 一時的なカスタマイズ（保存なし）

4. **ガイドツアー**
   - デモモード初回訪問時にチュートリアル
   - 主要機能のハイライト

## 関連 ADR

- [ADR 007: next-intl による i18n の採用](./007-adopt-next-intl-for-i18n.md)
- [ADR 002: Amplify Gen 2 + CDK への移行](./002-migrate-to-amplify-gen2-cdk.md)

## 参考資料

- 実装 PR: feat: Add demo mode for unauthenticated app exploration (6c80a3a)
- テスト PR: test: Add comprehensive demo mode tests and fix CI E2E (4539159)
- Seed Script: `scripts/seed-demo-data.ts`
- デモ URL: `/demo/timeline`, `/demo/events`, `/demo/dashboard`, `/demo/settings`
