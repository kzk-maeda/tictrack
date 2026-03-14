import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";
import * as bedrockagentcore from "aws-cdk-lib/aws-bedrockagentcore";

/**
 * AgentCoreConstruct — Deploy Strands Agent to Bedrock AgentCore Runtime
 *
 * Deploys the Tic Labeling Agent container to AWS Bedrock AgentCore Runtime.
 * AgentCore provides a managed, serverless environment for hosting AI agents.
 *
 * Requirements:
 * - Docker image must be ARM64 architecture
 * - Container must expose port 8080
 * - Image must be in ECR
 *
 * References:
 * - https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-bedrockagentcore-runtime.html
 * - https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/
 */
export class AgentCoreConstruct extends Construct {
  public readonly runtime: bedrockagentcore.CfnRuntime;
  public readonly agentExecutionRole: iam.Role;
  public readonly logGroup: logs.LogGroup;

  constructor(
    scope: Construct,
    id: string,
    props: {
      agentsRepository: ecr.Repository;
      imageTag?: string;
      environmentVariables?: { [key: string]: string };
      environment?: string;
    }
  ) {
    super(scope, id);

    const {
      agentsRepository,
      imageTag = "latest",
      environmentVariables = {},
      environment = "sandbox",
    } = props;
    const stack = cdk.Stack.of(this);
    const agentName = `tic_labeling_agent_${environment}`;

    // --- CloudWatch Logs for Agent Runtime ---
    this.logGroup = new logs.LogGroup(this, "AgentLogs", {
      logGroupName: `/aws/bedrock/agentcore/${agentName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- IAM Execution Role for Agent ---
    // The agent needs permissions to call Bedrock, Transcribe, DynamoDB, S3
    this.agentExecutionRole = new iam.Role(this, "AgentExecutionRole", {
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
      description:
        "Execution role for TicTrack Tic Labeling Agent in AgentCore Runtime",
    });

    // Grant permissions for AWS services the agent uses
    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Bedrock - Models
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          // Bedrock - Guardrails
          "bedrock:ApplyGuardrail",
          // Bedrock - Knowledge Bases
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate",
        ],
        resources: ["*"],
      })
    );

    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Transcribe
          "transcribe:StartTranscriptionJob",
          "transcribe:GetTranscriptionJob",
          "transcribe:ListTranscriptionJobs",
        ],
        resources: ["*"],
      })
    );

    // CloudWatch Logs permissions (required for AgentCore Runtime)
    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams", // Required for log stream management
        ],
        resources: [`${this.logGroup.logGroupArn}:*`],
      })
    );

    // ECR permissions (pull image)
    agentsRepository.grantPull(this.agentExecutionRole);

    // --- Bedrock AgentCore Runtime Configuration ---
    // ECR image URI
    const imageUri = `${agentsRepository.repositoryUri}:${imageTag}`;

    this.runtime = new bedrockagentcore.CfnRuntime(this, "TicLabelingRuntime", {
      agentRuntimeName: agentName,
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: imageUri,
        },
      },
      networkConfiguration: {
        networkMode: "PUBLIC", // Use PUBLIC for simplicity; VPC for production
      },
      roleArn: this.agentExecutionRole.roleArn,
      description:
        "TicTrack Tic Labeling Agent - AI-powered tic episode analysis using Strands Agents SDK",
      environmentVariables: {
        LOG_LEVEL: "INFO",
        AWS_REGION: stack.region,
        ...environmentVariables,
      },
      protocolConfiguration: "HTTP",
      // Note: loggingConfiguration not available in current CDK types
      // Logs should be accessible via CloudWatch Console or AWS CLI
    });

    // Runtime depends on role and log group
    this.runtime.node.addDependency(this.agentExecutionRole);
    this.runtime.node.addDependency(this.logGroup);

    // Note: DEFAULT endpoint is automatically created when Runtime is deployed
    // No need to explicitly create CfnRuntimeEndpoint

    // --- Outputs ---
    new cdk.CfnOutput(this, "AgentRuntimeArn", {
      value: this.runtime.ref, // Returns the ARN
      description: "ARN of the AgentCore Runtime deployment",
      exportName: `${stack.stackName}-AgentRuntimeArn`,
    });

    new cdk.CfnOutput(this, "AgentRuntimeId", {
      value: this.runtime.attrAgentRuntimeId,
      description: "ID of the AgentCore Runtime",
    });

    new cdk.CfnOutput(this, "AgentRuntimeEndpoint", {
      value: this.runtimeEndpoint,
      description: "HTTP endpoint URL for the AgentCore Runtime",
      exportName: `${stack.stackName}-AgentRuntimeEndpoint`,
    });

    new cdk.CfnOutput(this, "AgentExecutionRoleArn", {
      value: this.agentExecutionRole.roleArn,
      description: "IAM Role for Agent execution",
    });

    new cdk.CfnOutput(this, "ImageUri", {
      value: imageUri,
      description: "ECR Image URI for the agent",
    });

    new cdk.CfnOutput(this, "LogGroupName", {
      value: this.logGroup.logGroupName,
      description: "CloudWatch Log Group for agent logs",
    });
  }

  /**
   * Grant DynamoDB permissions to the agent
   */
  public grantDynamoDBAccess(tableArns: string[]) {
    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ],
        resources: tableArns,
      })
    );
  }

  /**
   * Grant S3 permissions to the agent
   */
  public grantS3Access(bucketArns: string[]) {
    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
        resources: [
          ...bucketArns,
          ...bucketArns.map((arn) => `${arn}/*`),
        ],
      })
    );
  }

  /**
   * Get the runtime ARN
   * Format: arn:aws:bedrock-agentcore:region:account:runtime/runtime-id
   */
  public get runtimeArn(): string {
    const stack = cdk.Stack.of(this);
    return `arn:aws:bedrock-agentcore:${stack.region}:${stack.account}:runtime/${this.runtime.attrAgentRuntimeId}`;
  }

  /**
   * Get the runtime ID
   */
  public get runtimeId(): string {
    return this.runtime.attrAgentRuntimeId;
  }

  /**
   * Get the runtime endpoint URL
   * Format: https://<runtime-id>.runtime.bedrock-agentcore.<region>.amazonaws.com
   */
  public get runtimeEndpoint(): string {
    const stack = cdk.Stack.of(this);
    return `https://${this.runtime.attrAgentRuntimeId}.runtime.bedrock-agentcore.${stack.region}.amazonaws.com`;
  }
}
