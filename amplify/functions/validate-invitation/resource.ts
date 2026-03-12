import { defineFunction } from "@aws-amplify/backend";

export const validateInvitation = defineFunction({
  name: "validate-invitation",
  entry: "./handler.ts",
  timeoutSeconds: 10,
  resourceGroupName: "auth", // Assign to auth stack to avoid circular dependency
});
