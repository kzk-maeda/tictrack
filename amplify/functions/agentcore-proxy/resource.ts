import { defineFunction } from "@aws-amplify/backend";

export const agentcoreProxy = defineFunction({
  name: "agentcore-proxy",
  entry: "./handler.ts",
  runtime: 20,
  timeoutSeconds: 900, // 15 minutes max for streaming
  memoryMB: 512,
  environment: {
    // Force update - correct response decode with transformToString
    CODE_VERSION: "v4.1-transform-to-string",
  },
});
