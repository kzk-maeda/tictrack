/**
 * Helper: get L1 CfnResource from L2 construct
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cfn(construct: any): { addPropertyOverride(path: string, value: unknown): void } {
  return construct.node.defaultChild;
}

/**
 * Configure S3 media bucket lifecycle rules
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configureStorage(storage: any): void {
  const mediaBucketCfn = cfn(storage.bucket);

  // Lifecycle rules: archive videos after 90 days, cleanup tmp after 1 day
  mediaBucketCfn.addPropertyOverride("LifecycleConfiguration", {
    Rules: [
      {
        Id: "archive-videos-90d",
        Prefix: "videos/",
        Status: "Enabled",
        Transitions: [
          {
            StorageClass: "GLACIER_IR",
            TransitionInDays: 90,
          },
        ],
      },
      {
        Id: "cleanup-tmp-1d",
        Prefix: "tmp/",
        Status: "Enabled",
        ExpirationInDays: 1,
      },
    ],
  });
}
