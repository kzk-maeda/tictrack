import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from "aws-cdk-lib";

/**
 * DatabaseConstruct — 12 DynamoDB tables for TicTrack
 *
 * All tables use PAY_PER_REQUEST billing and AWS-managed encryption.
 * PITR disabled (prototype). RemovalPolicy.DESTROY for sandbox cleanup.
 */
export class DatabaseConstruct extends Construct {
  public readonly usersTable: dynamodb.Table;
  public readonly childrenTable: dynamodb.Table;
  public readonly ticCardsTable: dynamodb.Table;
  public readonly medicationCardsTable: dynamodb.Table;
  public readonly episodesTable: dynamodb.Table;
  public readonly medicationLogsTable: dynamodb.Table;
  public readonly aiLabelsTable: dynamodb.Table;
  public readonly checkInsTable: dynamodb.Table;
  public readonly weeklyReportsTable: dynamodb.Table;
  public readonly shareTokensTable: dynamodb.Table;
  public readonly lifeEventsTable: dynamodb.Table;
  public readonly invitationsTable: dynamodb.Table;

  /** ARNs of all 12 tables */
  public readonly allTableArns: string[];
  /** ARNs of all tables + their GSI indexes */
  public readonly allTableAndIndexArns: string[];

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // --- Users ---
    this.usersTable = new dynamodb.Table(this, "Users", {

      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- Children ---
    this.childrenTable = new dynamodb.Table(this, "Children", {

      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.childrenTable.addGlobalSecondaryIndex({
      indexName: "userId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- TicCards ---
    this.ticCardsTable = new dynamodb.Table(this, "TicCards", {
      partitionKey: { name: "cardId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.ticCardsTable.addGlobalSecondaryIndex({
      indexName: "childId-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- MedicationCards ---
    this.medicationCardsTable = new dynamodb.Table(this, "MedicationCards", {
      partitionKey: { name: "medicationId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.medicationCardsTable.addGlobalSecondaryIndex({
      indexName: "childId-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Episodes ---
    this.episodesTable = new dynamodb.Table(this, "Episodes", {
      partitionKey: { name: "episodeId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.episodesTable.addGlobalSecondaryIndex({
      indexName: "childId-occurredAt-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "occurredAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- MedicationLogs ---
    this.medicationLogsTable = new dynamodb.Table(this, "MedicationLogs", {
      partitionKey: { name: "logId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.medicationLogsTable.addGlobalSecondaryIndex({
      indexName: "childId-takenAt-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "takenAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.medicationLogsTable.addGlobalSecondaryIndex({
      indexName: "medicationId-takenAt-index",
      partitionKey: { name: "medicationId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "takenAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- AILabels (composite key: episodeId + version) ---
    this.aiLabelsTable = new dynamodb.Table(this, "AILabels", {
      partitionKey: { name: "episodeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "version", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- CheckIns ---
    this.checkInsTable = new dynamodb.Table(this, "CheckIns", {
      partitionKey: { name: "checkInId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.checkInsTable.addGlobalSecondaryIndex({
      indexName: "childId-weekStart-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "weekStart", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- WeeklyReports ---
    this.weeklyReportsTable = new dynamodb.Table(this, "WeeklyReports", {
      partitionKey: { name: "reportId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.weeklyReportsTable.addGlobalSecondaryIndex({
      indexName: "childId-weekStart-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "weekStart", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- ShareTokens (TTL enabled) ---
    this.shareTokensTable = new dynamodb.Table(this, "ShareTokens", {
      partitionKey: { name: "shareToken", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "TTL",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- LifeEvents ---
    this.lifeEventsTable = new dynamodb.Table(this, "LifeEvents", {
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.lifeEventsTable.addGlobalSecondaryIndex({
      indexName: "childId-occurredAt-index",
      partitionKey: { name: "childId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "occurredAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Invitations (for invite-only signup) ---
    this.invitationsTable = new dynamodb.Table(this, "Invitations", {
      partitionKey: { name: "invitationCode", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.invitationsTable.addGlobalSecondaryIndex({
      indexName: "email-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Convenience properties for IAM grants
    this.allTableArns = [
      this.usersTable,
      this.childrenTable,
      this.ticCardsTable,
      this.medicationCardsTable,
      this.episodesTable,
      this.medicationLogsTable,
      this.aiLabelsTable,
      this.checkInsTable,
      this.weeklyReportsTable,
      this.shareTokensTable,
      this.lifeEventsTable,
      this.invitationsTable,
    ].map((t) => t.tableArn);

    this.allTableAndIndexArns = this.allTableArns.flatMap((arn) => [
      arn,
      `${arn}/index/*`,
    ]);
  }
}
