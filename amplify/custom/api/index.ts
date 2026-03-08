import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export interface ApiConstructProps {
  /** Cognito User Pool for authorization */
  userPool: cognito.IUserPool;
  /** Lambda function for API handling */
  apiHandlerFn: lambda.IFunction;
  /** CORS allowed origin (e.g. https://main.d123.amplifyapp.com or *) */
  corsOrigin: string;
  /** AgentCore Proxy Lambda (optional, for AI labeling integration) */
  agentCoreProxyFn?: lambda.IFunction;
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

    const { userPool, apiHandlerFn, corsOrigin, agentCoreProxyFn } = props;

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

    // --- AgentCore Proxy Integration: /analyze/{episodeId} (Step 4+) ---
    if (agentCoreProxyFn) {
      const agentCoreProxyIntegration = new apigateway.LambdaIntegration(
        agentCoreProxyFn,
        {
          proxy: true, // Lambda proxy integration
        }
      );

      // POST /analyze/{episodeId}
      const analyzeResource = this.restApi.root
        .addResource("analyze")
        .addResource("{episodeId}");

      analyzeResource.addMethod("POST", agentCoreProxyIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      });
    }
  }
}
