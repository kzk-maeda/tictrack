// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDynamoDBMock } from "./helpers/dynamodb-mock.js";
import { createMockEvent } from "./helpers/event-factory.js";

const { send } = createDynamoDBMock();

// Must import handler AFTER mocks are set up
const { handler } = await import("../handler.js");

describe("handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for request without auth token (TDD #8)", async () => {
    const event = createMockEvent({
      method: "GET",
      path: "/children",
      noAuth: true,
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.status).toBe(401);
    expect(body.title).toBeDefined();
  });

  it("returns 404 for unknown route", async () => {
    const event = createMockEvent({
      method: "GET",
      path: "/unknown",
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.status).toBe(404);
  });

  it("returns CORS headers on every response", async () => {
    const event = createMockEvent({
      method: "GET",
      path: "/children",
    });
    send.mockResolvedValueOnce({ Items: [] });

    const result = await handler(event);

    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
    expect(result.headers?.["Content-Type"]).toBe("application/json");
  });

  it("routes GET /children to children list handler", async () => {
    const event = createMockEvent({
      method: "GET",
      path: "/children",
    });
    send.mockResolvedValueOnce({ Items: [] });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });
});
