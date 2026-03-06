import type { APIGatewayProxyEvent } from "aws-lambda";
import { UnauthorizedError } from "./errors.js";

export function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims?.sub) {
    throw new UnauthorizedError("Missing authentication claims");
  }
  return claims.sub as string;
}
