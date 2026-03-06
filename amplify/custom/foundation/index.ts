import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { RemovalPolicy } from "aws-cdk-lib";

/**
 * FoundationConstruct — S3 knowledge bucket + ECR repository
 *
 * These resources are shared across multiple steps and
 * have no Amplify-native equivalent (defineStorage is for user-facing buckets).
 */
export class FoundationConstruct extends Construct {
  public readonly knowledgeBucket: s3.Bucket;
  public readonly agentsRepository: ecr.Repository;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // --- S3 Knowledge Bucket ---
    // Stores micro-guide articles for RAG (Knowledge Base)
    this.knowledgeBucket = new s3.Bucket(this, "KnowledgeBucket", {
      bucketName: undefined, // Auto-generated with stack prefix
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- ECR Repository ---
    // Docker images for Strands Agent (AgentCore runtime)
    this.agentsRepository = new ecr.Repository(this, "AgentsRepo", {
      repositoryName: undefined, // Auto-generated with stack prefix
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        {
          description: "Keep last 5 images",
          maxImageCount: 5,
        },
      ],
    });
  }
}
