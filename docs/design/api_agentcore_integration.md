# API Gateway → AgentCore Runtime 直接統合設計

## 概要

Lambda Proxy を廃止し、API Gateway から AgentCore Runtime へ直接 HTTP 統合する簡略化アーキテクチャ。

**変更理由**:
- プロトタイプ開発の高速化
- レイテンシ削減
- コスト削減
- 実装量削減

## アーキテクチャ

### Before（元の計画）
```
Client → API Gateway → Lambda Proxy → AgentCore Runtime (HTTP)
                           ↓
                       DynamoDB
```

### After（新設計）
```
Client → API Gateway → AgentCore Runtime (HTTP)
                           ↓ (Agent 内部で)
                       DynamoDB
```

**簡略化のポイント**:
- ✅ Lambda Proxy 削除
- ✅ DynamoDB 更新は Agent 内部で実行（既に実装済み）
- ✅ API Gateway が直接 HTTP 呼び出し

## API 仕様

### エンドポイント

```
POST /analyze/{episodeId}
```

### リクエスト

```json
{
  "childId": "01KK11GVTQ9ZBGDFP84BKBZJ5B",
  "s3Key": "videos/.../video.webm",
  "bucketName": "tictrack-media-...",
  "videoMimeType": "video/webm"
}
```

### レスポンス（成功）

```json
{
  "episodeId": "01KK1KKSCDKQC4AN9TV19B6228",
  "status": "completed",
  "label": {
    "labelId": "01KK1KKSCDKQC4AN9TV19B6228-v1",
    "type": "motor",
    "severity": 3,
    "confidence": 0.85,
    "observations": [...]
  }
}
```

### レスポンス（エラー）

```json
{
  "episodeId": "01KK1KKSCDKQC4AN9TV19B6228",
  "status": "failed",
  "error": "Error message"
}
```

## CDK 実装

### 1. AgentCore Runtime エンドポイント取得

AgentCore Runtime がデプロイされると、HTTP エンドポイントが生成される:

```
https://<runtime-id>.runtime.bedrock-agentcore.ap-northeast-1.amazonaws.com
```

CloudFormation Outputs から取得:
```typescript
const agentCoreEndpoint = agentCore.runtime.attrAgentRuntimeEndpoint;
```

### 2. IAM Role 設定

API Gateway が AgentCore Runtime を呼び出すための IAM Role:

```typescript
const apiGatewayAgentCoreRole = new iam.Role(this, "ApiGatewayAgentCoreRole", {
  assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
  description: "Allow API Gateway to invoke AgentCore Runtime",
});

// AgentCore Runtime 呼び出し権限
apiGatewayAgentCoreRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ["bedrock-agentcore:InvokeRuntime"],
    resources: [agentCore.runtimeArn],
  })
);
```

### 3. HTTP Integration 設定

```typescript
// HTTP Integration to AgentCore Runtime
const agentCoreIntegration = new apigateway.AwsIntegration({
  service: "bedrock-agentcore",
  action: "InvokeRuntime",
  options: {
    credentialsRole: apiGatewayAgentCoreRole,
    passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
    requestTemplates: {
      "application/json": JSON.stringify({
        runtimeArn: agentCore.runtimeArn,
        inputText: "$util.escapeJavaScript($input.json('$'))",
      }),
    },
    integrationResponses: [
      {
        statusCode: "200",
        responseTemplates: {
          "application/json": "$input.json('$')",
        },
      },
      {
        statusCode: "500",
        selectionPattern: "5\\d{2}",
        responseTemplates: {
          "application/json": JSON.stringify({
            error: "AgentCore Runtime error",
          }),
        },
      },
    ],
  },
});
```

### 4. API Gateway ルート追加

```typescript
// POST /analyze/{episodeId}
const analyzeResource = api.root
  .addResource("analyze")
  .addResource("{episodeId}");

analyzeResource.addMethod("POST", agentCoreIntegration, {
  authorizationType: apigateway.AuthorizationType.COGNITO,
  authorizer: cognitoAuthorizer,
  methodResponses: [
    { statusCode: "200" },
    { statusCode: "500" },
  ],
});
```

## 実装手順

### Phase 1: AgentCore Runtime デプロイ完了（進行中）

- [x] CDK Construct 作成
- [x] Docker イメージビルド＆プッシュ
- [ ] CloudFormation デプロイ
- [ ] エンドポイント確認

### Phase 2: API Gateway 統合

1. **AgentCore Construct を拡張**
   - Runtime Endpoint を Outputs に追加
   - `attrAgentRuntimeEndpoint` を取得

2. **ApiConstruct を更新**
   - IAM Role 作成
   - HTTP Integration 設定
   - `/analyze/{episodeId}` ルート追加
   - Request/Response マッピング

3. **backend.ts を更新**
   - AgentCore endpoint を ApiConstruct に渡す
   - IAM 権限を付与

### Phase 3: テスト

1. **ローカルテスト**
   - Postman で API エンドポイントをテスト
   - 認証トークン取得
   - リクエスト送信

2. **統合テスト**
   - 実際の S3 動画でテスト
   - DynamoDB にラベルが保存されるか確認
   - CloudWatch Logs で Agent の動作確認

## トレードオフ

### メリット

| 項目 | 詳細 |
|------|------|
| **実装速度** | Lambda コード不要、API Gateway 設定のみ |
| **レイテンシ** | Lambda の Cold Start 削減 |
| **コスト** | Lambda 呼び出し料金削減 |
| **シンプル** | コンポーネント数削減 |

### デメリット

| 項目 | 詳細 | 対処法 |
|------|------|--------|
| **ビジネスロジック** | API Gateway で複雑なロジック困難 | Agent 内部で実装 |
| **エラーハンドリング** | マッピングテンプレートで限定的 | Agent 側で詳細エラー返す |
| **トランザクション** | DynamoDB 更新を Agent に依存 | Agent 内で確実に実装 |

## 将来の拡張性

必要に応じて Lambda Proxy を後から追加可能:

```
Client → API Gateway → Lambda Proxy → AgentCore Runtime
                           ↓
                       追加ロジック
                       (認証強化、ログ、監視等)
```

プロトタイプでは直接統合でシンプルに開始し、本番で必要になったら Lambda を追加する段階的アプローチ。

## 参考資料

- [API Gateway AWS Service Integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html)
- [VTL Request/Response Templates](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html)
- [IAM Roles for API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/permissions.html)
