import { defineFunction } from "@aws-amplify/backend";

export const apiHandler = defineFunction({
  name: "api-handler",
  entry: "./handler.ts",
  runtime: 20,
  memoryMB: 256,
  timeoutSeconds: 30,
  architecture: "arm64",
});
