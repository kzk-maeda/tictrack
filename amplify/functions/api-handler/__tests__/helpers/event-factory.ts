import type { APIGatewayProxyEvent } from "aws-lambda";

interface MockEventOptions {
  method?: string;
  path?: string;
  body?: unknown;
  pathParameters?: Record<string, string> | null;
  queryParams?: Record<string, string> | null;
  userId?: string;
  noAuth?: boolean;
}

export function createMockEvent(
  options: MockEventOptions = {},
): APIGatewayProxyEvent {
  const {
    method = "GET",
    path = "/",
    body = null,
    pathParameters = null,
    queryParams = null,
    userId = "test-user-id-123",
    noAuth = false,
  } = options;

  return {
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    pathParameters,
    queryStringParameters: queryParams,
    multiValueQueryStringParameters: null,
    headers: {
      "Content-Type": "application/json",
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    stageVariables: null,
    resource: "/{proxy+}",
    requestContext: {
      authorizer: noAuth
        ? undefined
        : { claims: { sub: userId, email: "test@example.com" } },
      accountId: "123456789012",
      apiId: "test-api-id",
      httpMethod: method,
      identity: {} as never,
      path,
      protocol: "HTTP/1.1",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "test-resource-id",
      resourcePath: "/{proxy+}",
      stage: "dev",
    },
  };
}
