import type { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE!;

interface Invitation {
  invitationCode: string;
  email?: string;
  used: boolean;
  usedBy?: string;
  usedAt?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Pre-signup Lambda Trigger
 * Validates invitation code before allowing user signup
 */
export const handler: PreSignUpTriggerHandler = async (
  event: PreSignUpTriggerEvent
): Promise<PreSignUpTriggerEvent> => {
  console.log("Pre-signup trigger invoked", {
    email: event.request.userAttributes.email,
    triggerSource: event.triggerSource,
  });

  try {
    // Extract invitation code from validationData
    const invitationCode = event.request.validationData?.invitationCode;
    if (!invitationCode) {
      throw new Error("Invitation code is required");
    }

    const userEmail = event.request.userAttributes.email;

    // Get invitation from DynamoDB
    const invitation = await getInvitation(invitationCode);

    // Validate invitation
    validateInvitation(invitation, userEmail);

    // Mark invitation as used
    await markInvitationAsUsed(invitationCode, event.userName);

    console.log("Invitation validated successfully", {
      invitationCode,
      email: userEmail,
    });

    // Allow signup
    return event;
  } catch (error) {
    console.error("Invitation validation failed", error);

    // Re-throw error to prevent signup
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to validate invitation");
  }
};

/**
 * Get invitation from DynamoDB
 */
async function getInvitation(invitationCode: string): Promise<Invitation> {
  const result = await ddbClient.send(
    new GetCommand({
      TableName: INVITATIONS_TABLE,
      Key: { invitationCode },
    })
  );

  if (!result.Item) {
    throw new Error("Invalid invitation code");
  }

  return result.Item as Invitation;
}

/**
 * Validate invitation constraints
 */
function validateInvitation(invitation: Invitation, userEmail: string): void {
  // Check if already used
  if (invitation.used) {
    throw new Error("Invitation code has already been used");
  }

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  if (expiresAt < now) {
    throw new Error("Invitation code has expired");
  }

  // Check email match (if invitation has email restriction)
  if (invitation.email && invitation.email !== userEmail) {
    throw new Error("This invitation is for a different email address");
  }
}

/**
 * Mark invitation as used
 */
async function markInvitationAsUsed(
  invitationCode: string,
  usedBy: string
): Promise<void> {
  await ddbClient.send(
    new UpdateCommand({
      TableName: INVITATIONS_TABLE,
      Key: { invitationCode },
      UpdateExpression: "SET #used = :used, usedBy = :usedBy, usedAt = :usedAt",
      ExpressionAttributeNames: {
        "#used": "used",
      },
      ExpressionAttributeValues: {
        ":used": true,
        ":usedBy": usedBy,
        ":usedAt": new Date().toISOString(),
      },
    })
  );
}
