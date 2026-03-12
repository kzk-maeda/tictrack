/**
 * Helper: get L1 CfnResource from L2 construct
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cfn(construct: any): { addPropertyOverride(path: string, value: unknown): void } {
  return construct.node.defaultChild;
}

/**
 * Configure Cognito User Pool and User Pool Client overrides
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configureAuth(auth: any): void {
  // =====================================================================
  // Cognito User Pool overrides
  // =====================================================================

  const userPoolCfn = cfn(auth.userPool);

  // Password policy: min 8, uppercase, lowercase, numbers, symbols
  userPoolCfn.addPropertyOverride("Policies", {
    PasswordPolicy: {
      MinimumLength: 8,
      RequireLowercase: true,
      RequireUppercase: true,
      RequireNumbers: true,
      RequireSymbols: true,
      TemporaryPasswordValidityDays: 7,
    },
  });

  // Custom attribute: coppa_consent (Boolean, mutable)
  userPoolCfn.addPropertyOverride("Schema", [
    {
      Name: "coppa_consent",
      AttributeDataType: "Boolean",
      Mutable: true,
      Required: false,
    },
  ]);

  // =====================================================================
  // User Pool Client overrides
  // =====================================================================

  const userPoolClientCfn = cfn(auth.userPoolClient);

  // Token validity (1h/1h/30d)
  userPoolClientCfn.addPropertyOverride("AccessTokenValidity", 1);
  userPoolClientCfn.addPropertyOverride("IdTokenValidity", 1);
  userPoolClientCfn.addPropertyOverride("RefreshTokenValidity", 30);
  userPoolClientCfn.addPropertyOverride("TokenValidityUnits", {
    AccessToken: "hours",
    IdToken: "hours",
    RefreshToken: "days",
  });
}
