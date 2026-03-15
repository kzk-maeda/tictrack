import { Construct } from "constructs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface OrchestrationConstructProps {
  invokeAgentCoreLambda: lambda.IFunction;
  episodesTable: dynamodb.ITable;
  aiLabelsTable: dynamodb.ITable;
}

/**
 * OrchestrationConstruct — Step Functions workflow for AI labeling
 *
 * Orchestrates async AI analysis with:
 * - InvokeAgentCore Lambda invocation
 * - DynamoDB operations (store AI label, update episode status)
 * - Error handling with retry and failure states
 */
export class OrchestrationConstruct extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: OrchestrationConstructProps & { environment?: string }) {
    super(scope, id);

    const env = props.environment ?? "sandbox";

    // CloudWatch Log Group for Step Functions
    const logGroup = new logs.LogGroup(this, "StateMachineLogGroup", {
      logGroupName: `/aws/stepfunctions/ai-labeling-workflow-${env}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Define Step Functions workflow using ASL
    const definition = {
      Comment: "AI Labeling Workflow for Tic Episodes",
      StartAt: "InvokeAgentCore",
      States: {
        InvokeAgentCore: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: props.invokeAgentCoreLambda.functionArn,
            Payload: {
              "episodeId.$": "$.episodeId",
              "childId.$": "$.childId",
              "s3Key.$": "$.s3Key",
              "bucketName.$": "$.bucketName",
              "videoMimeType.$": "$.videoMimeType",
            },
          },
          Retry: [
            {
              ErrorEquals: [
                "States.TaskFailed",
                "Lambda.ServiceException",
                "Lambda.TooManyRequestsException",
              ],
              IntervalSeconds: 10,
              MaxAttempts: 3,
              BackoffRate: 2.0,
            },
          ],
          Catch: [
            {
              ErrorEquals: ["States.ALL"],
              ResultPath: "$.error",
              Next: "MarkAsFailed",
            },
          ],
          ResultPath: "$.agentResult",
          Next: "UpdateEpisode",
          Comment: "Agent's store_label tool has already saved to AILabels and Episodes tables",
        },
        UpdateEpisode: {
          Type: "Task",
          Resource: "arn:aws:states:::dynamodb:updateItem",
          Parameters: {
            TableName: props.episodesTable.tableName,
            Key: {
              "episodeId": { "S.$": "$.episodeId" },
            },
            UpdateExpression: "SET labelStatus = :status, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":status": { "S": "ai_suggested" },
              ":updatedAt": { "S.$": "$$.State.EnteredTime" },
            },
            // Note: originalAILabel is already updated by store_label tool in the agent
          },
          Catch: [
            {
              ErrorEquals: ["States.ALL"],
              ResultPath: "$.error",
              Next: "MarkAsFailed",
            },
          ],
          End: true,
        },
        MarkAsFailed: {
          Type: "Task",
          Resource: "arn:aws:states:::dynamodb:updateItem",
          Parameters: {
            TableName: props.episodesTable.tableName,
            Key: {
              "episodeId": { "S.$": "$.episodeId" },
            },
            UpdateExpression: "SET labelStatus = :status, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":status": { "S": "failed" },
              ":updatedAt": { "S.$": "$$.State.EnteredTime" },
            },
          },
          End: true,
        },
      },
    };

    // Create IAM role for Step Functions
    const role = new iam.Role(this, "StateMachineRole", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
    });

    // Grant permissions to invoke Lambda
    props.invokeAgentCoreLambda.grantInvoke(role);

    // Grant permissions to write to DynamoDB
    props.episodesTable.grantWriteData(role);
    props.aiLabelsTable.grantWriteData(role);

    // Grant permissions to write to CloudWatch Logs
    logGroup.grantWrite(role);

    // Create State Machine
    this.stateMachine = new sfn.StateMachine(this, "AILabelingWorkflow", {
      stateMachineName: `AILabelingWorkflow-${env}`,
      definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition)),
      role,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
      timeout: Duration.minutes(15),
    });
  }
}
