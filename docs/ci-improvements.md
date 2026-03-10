# CI/CD 改善ドキュメント

## 改善内容

### 1. 依存関係のキャッシュと共有

**問題点**:
- 各ジョブで毎回 `npm ci` を実行していた
- Playwright ブラウザも毎回インストールしていた
- 合計で 3 回以上の依存関係インストールが発生

**改善策**:
```yaml
setup:
  name: Setup Dependencies
  steps:
    - name: Cache node_modules
      uses: actions/cache@v4
      with:
        path: |
          node_modules
          amplify/functions/agentcore-proxy/node_modules
          amplify/functions/start-analysis/node_modules
        key: ${{ runner.os }}-node-modules-${{ hashFiles('**/package-lock.json') }}
```

**効果**:
- 依存関係のインストールは 1 回のみ
- 後続のジョブはキャッシュから復元（数秒で完了）
- CI 実行時間を約 2-3 分短縮

### 2. ジョブの並列実行

**問題点**:
- test → e2e の順にシリアル実行
- test ジョブ内で test, lint, build を順次実行

**改善策**:
```yaml
setup → [test, lint, build] → e2e
```

**ジョブ構成**:
- `setup`: 依存関係のインストールとキャッシュ
- `test`: ユニットテスト（並列）
- `lint`: Lint チェック（並列）
- `build`: Next.js ビルド（並列）
- `e2e`: E2E テスト（build 完了後）

**効果**:
- test, lint, build が並列実行
- 全体の実行時間を約 3-5 分短縮

### 3. E2E テストの修正

**問題点**:
- E2E テストが dev モードで起動していた
- ビルド成果物が正しく使用されていなかった

**改善策**:

**playwright.config.ts**:
```typescript
webServer: {
  // CI環境ではビルド済みの成果物を使用
  command: process.env.CI ? "npm run start" : "npm run dev",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000, // 2分
}
```

**CI ワークフロー**:
```yaml
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: build
    # .next/ と public/ を復元
```

**効果**:
- E2E テストが本番ビルドで実行される
- テストの信頼性が向上
- 起動時間が短縮（dev モードより高速）

## 実行時間の比較

### 改善前
```
setup (test job):     ~3分
  - npm ci:           ~2分
  - test:             ~30秒
  - lint:             ~20秒
  - build:            ~1分

setup (e2e job):      ~3分
  - npm ci:           ~2分
  - playwright:       ~1分
  - e2e tests:        ~2分

合計: ~8分
```

### 改善後
```
setup:                ~3分
  - npm ci:           ~2分
  - playwright:       ~1分

並列実行:
  - test:             ~30秒
  - lint:             ~20秒
  - build:            ~1分

e2e:                  ~2分
  - e2e tests:        ~2分

合計: ~5分（並列実行により）
```

**削減時間**: 約 3 分（37.5% 削減）

## キャッシュ戦略

### node_modules キャッシュ
- **キー**: `${{ runner.os }}-node-modules-${{ hashFiles('**/package-lock.json') }}`
- **パス**: 
  - `node_modules`
  - `amplify/functions/agentcore-proxy/node_modules`
  - `amplify/functions/start-analysis/node_modules`
- **有効期限**: package-lock.json が変更されるまで

### Playwright ブラウザキャッシュ
- **キー**: `${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}`
- **パス**: `~/.cache/ms-playwright`
- **有効期限**: package-lock.json が変更されるまで

### Next.js ビルドキャッシュ
- **キー**: `${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}`
- **パス**: `.next/cache`
- **有効期限**: ソースコードが変更されるまで

## トラブルシューティング

### キャッシュが効かない場合

1. **キャッシュをクリア**:
   - GitHub リポジトリの Settings → Actions → Caches
   - 古いキャッシュを削除

2. **package-lock.json を更新**:
   ```bash
   npm install
   git add package-lock.json
   git commit -m "Update package-lock.json"
   ```

### E2E テストが失敗する場合

1. **ローカルで確認**:
   ```bash
   npm run build
   npm run start &
   npm run test:e2e
   ```

2. **タイムアウトを調整**:
   ```typescript
   // playwright.config.ts
   webServer: {
     timeout: 180 * 1000, // 3分に延長
   }
   ```

3. **ログを確認**:
   - GitHub Actions の Playwright report をダウンロード
   - test-results/ を確認

## 今後の改善案

### 1. マトリックスビルド
複数の Node.js バージョンでテスト:
```yaml
strategy:
  matrix:
    node-version: [18, 20]
```

### 2. 条件付き実行
変更されたファイルに応じてジョブをスキップ:
```yaml
- uses: dorny/paths-filter@v2
  id: changes
  with:
    filters: |
      src:
        - 'src/**'
      e2e:
        - 'e2e/**'
```

### 3. キャッシュの最適化
- Turborepo や Nx を導入してビルドキャッシュを改善
- Docker レイヤーキャッシュの活用

### 4. テストの並列化
- Playwright のシャーディング機能を使用
- 複数のワーカーで E2E テストを並列実行

## 参考資料

- [GitHub Actions - Caching dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Playwright - CI/CD](https://playwright.dev/docs/ci)
- [Next.js - CI Build Caching](https://nextjs.org/docs/pages/building-your-application/deploying/ci-build-caching)
