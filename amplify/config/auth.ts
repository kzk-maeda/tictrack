import type { DatabaseConstruct } from "../custom/database/index";

export interface AuthConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateInvitation: any;
  database: DatabaseConstruct;
}

/**
 * Helper: get L1 CfnResource from L2 construct
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cfn(construct: any): { addPropertyOverride(path: string, value: unknown): void } {
  return construct.node.defaultChild;
}

/**
 * Configure Cognito User Pool and User Pool Client overrides + Pre-signup trigger
 */
export function configureAuth(config: AuthConfig): void {
  // =====================================================================
  // Cognito User Pool overrides
  // =====================================================================

  const userPoolCfn = cfn(config.auth.userPool);

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

  const userPoolClientCfn = cfn(config.auth.userPoolClient);

  // Token validity (1h/1h/30d)
  userPoolClientCfn.addPropertyOverride("AccessTokenValidity", 1);
  userPoolClientCfn.addPropertyOverride("IdTokenValidity", 1);
  userPoolClientCfn.addPropertyOverride("RefreshTokenValidity", 30);
  userPoolClientCfn.addPropertyOverride("TokenValidityUnits", {
    AccessToken: "hours",
    IdToken: "hours",
    RefreshToken: "days",
  });

  // =====================================================================
  // Pre-signup Trigger: Validate invitation code
  // =====================================================================

  // Add environment variable for invitations table
  config.validateInvitation.addEnvironment(
    "INVITATIONS_TABLE",
    config.database.invitationsTable.tableName
  );

  // Grant Lambda permission to read/write invitations table
  config.database.invitationsTable.grantReadWriteData(
    config.validateInvitation.resources.lambda
  );

  // Grant User Pool permission to invoke Lambda
  config.validateInvitation.resources.lambda.grantInvoke(config.auth.userPool);

  // Add Pre-signup trigger to User Pool via LambdaConfig
  userPoolCfn.addPropertyOverride("LambdaConfig", {
    PreSignUp: config.validateInvitation.resources.lambda.functionArn,
  });
}
