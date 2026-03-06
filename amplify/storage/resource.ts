import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "tictrack-media",
  access: (allow) => ({
    "videos/{entity_id}/*": [
      allow.entity("identity").to(["read", "write", "delete"]),
    ],
    "tmp/*": [allow.authenticated.to(["read", "write", "delete"])],
    "reports/*": [allow.authenticated.to(["read"])],
  }),
  // Lifecycle rules (videos/→GLACIER_IR@90d, tmp/→delete@1d)
  // are applied via cfnBucket override in backend.ts
});
