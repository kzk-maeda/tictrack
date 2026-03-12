import { vi } from "vitest";

export function createDynamoDBMock() {
  const send = vi.fn();

  vi.doMock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: class MockDynamoDBClient {},
  }));

  vi.doMock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send })) },
    PutCommand: class MockPutCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetCommand: class MockGetCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    QueryCommand: class MockQueryCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    UpdateCommand: class MockUpdateCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    DeleteCommand: class MockDeleteCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    BatchGetCommand: class MockBatchGetCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  }));

  return { send };
}
