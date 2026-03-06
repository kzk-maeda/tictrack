import { defineAuth } from "@aws-amplify/backend";

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Password policy: min 8, uppercase, lowercase, numbers, symbols
  // Configured via CfnUserPool override in backend.ts
  //
  // Custom attribute: coppa_consent (Boolean) — added via CfnUserPool override in backend.ts
  // MFA: OFF (prototype)
  // Account recovery: verified_email (Amplify default)
});
