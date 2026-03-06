import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { route } from "./router.js";
import { AppError } from "./lib/errors.js";
import { problemDetails } from "./lib/response.js";

// CORS configuration for API Gateway
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: "",
    };
  }

  try {
    const result = await route(event);

    return {
      statusCode: result.statusCode,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: result.body !== null ? JSON.stringify(result.body) : "",
    };
  } catch (error) {
    if (error instanceof AppError) {
      const result = problemDetails(error.statusCode, error.name, error.message);
      return {
        statusCode: result.statusCode,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify(result.body),
      };
    }

    console.error("Unhandled error:", error);
    const result = problemDetails(500, "Internal Server Error");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify(result.body),
    };
  }
};
