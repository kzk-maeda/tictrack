import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Duration } from "aws-cdk-lib";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export interface ApiConstructProps {
  /** Cognito User Pool for authorization */
  userPool: cognito.IUserPool;
  /** Lambda function for API handling */
  apiHandlerFn: lambda.IFunction;
  /** CORS allowed origin (e.g. https://main.d123.amplifyapp.com or *) */
  corsOrigin: string;
  /** AgentCore Proxy Lambda (optional, for AI labeling integration) */
  agentCoreProxyFn?: lambda.IFunction;
  /** Step Functions State Machine ARN (optional, for async AI analysis) */
  stateMachineArn?: string;
  /** Episodes DynamoDB table (optional, for async AI analysis) */
  episodesTable?: dynamodb.ITable;
  /** Children DynamoDB table (optional, for ownership verification) */
  childrenTable?: dynamodb.ITable;
  /** S3 media bucket (optional, for video storage) */
  mediaBucket?: any; // Using any to avoid importing s3.IBucket
  /** AWS Region */
  region?: string;
}

/**
 * ApiConstruct — REST API with Cognito Authorizer
 *
 * Routes:
 *   /{proxy+}              ANY   → api-handler (Cognito auth)
 *   /shared/{proxy+}       ANY   → api-handler (no auth, public shared reports/videos)
 *   /analyze/{episodeId}   POST  → agentcore-proxy Lambda (Cognito auth, Step 4+)
 *
 * CORS preflight handled by defaultCorsPreflightOptions.
 */
export class ApiConstruct extends Construct {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // ES module equivalent of __dirname
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const { userPool, apiHandlerFn, corsOrigin, agentCoreProxyFn, stateMachineArn, episodesTable, childrenTable, mediaBucket, region } = props;

    // --- REST API ---
    this.restApi = new apigateway.RestApi(this, "RestApi", {
      restApiName: "tictrack-api",
      description: "TicTrack REST API",
      deploy: true,
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [corsOrigin],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // --- Cognito Authorizer ---
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

    // --- Lambda Integration ---
    const lambdaIntegration = new apigateway.LambdaIntegration(apiHandlerFn);

    // --- Authenticated routes: /{proxy+} ---
    const proxyResource = this.restApi.root.addResource("{proxy+}");
    proxyResource.addMethod("ANY", lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
    });

    // --- Public routes: /shared/{proxy+} ---
    const sharedResource = this.restApi.root.addResource("shared");
    const sharedProxy = sharedResource.addResource("{proxy+}");
    sharedProxy.addMethod("ANY", lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // --- Demo mode routes: /demo/{proxy+} (no authentication) ---
    const demoResource = this.restApi.root.addResource("demo");
    const demoProxy = demoResource.addResource("{proxy+}");
    demoProxy.addMethod("ANY", lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // --- Start Analysis Integration: /analyze/{episodeId} (Step Functions) ---
    if (stateMachineArn && episodesTable && childrenTable && mediaBucket) {
      // Get current file's directory path (ES module compatible)
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Create startAnalysis Lambda directly in this stack to avoid circular dependency
      const startAnalysisLambda = new lambdaNodejs.NodejsFunction(
        this,
        "StartAnalysisFunction",
        {
          functionName: "start-analysis",
          runtime: lambda.Runtime.NODEJS_20_X,
          entry: join(__dirname, "../../functions/start-analysis/handler.ts"),
          handler: "handler",
          timeout: Duration.seconds(10),
          memorySize: 256,
          environment: {
            STATE_MACHINE_ARN: stateMachineArn,
            EPISODES_TABLE: episodesTable.tableName,
            CHILDREN_TABLE: childrenTable.tableName,
            MEDIA_BUCKET: mediaBucket.bucketName,
            // AWS_REGION is automatically provided by Lambda runtime
          },
        }
      );

      // Grant permissions to start Step Functions execution
      startAnalysisLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["states:StartExecution"],
          resources: [stateMachineArn],
        })
      );

      // Grant permissions to read Episodes table and update with analysis status
      episodesTable.grantReadWriteData(startAnalysisLambda);

      // Grant permissions to read Children table for ownership verification
      childrenTable.grantReadData(startAnalysisLambda);

      const startAnalysisIntegration = new apigateway.LambdaIntegration(
        startAnalysisLambda,
        {
          proxy: true, // Lambda proxy integration
        }
      );

      // POST /analyze/{episodeId}
      const analyzeResource = this.restApi.root
        .addResource("analyze")
        .addResource("{episodeId}");

      analyzeResource.addMethod("POST", startAnalysisIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      });
    }
  }
}
