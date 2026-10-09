/**
 * OpsForge never emulates a vendor. Objectives keep the vendor's words
 * because they describe a public exam; anything OpsForge builds (labs,
 * "lab planned" cards, simulated services) uses these neutral names instead.
 */
export const VENDOR_NEUTRAL: Array<{ vendorTerm: string; opsforgeTerm: string }> = [
  { vendorTerm: "VPC", opsforgeTerm: "virtual network" },
  { vendorTerm: "security group", opsforgeTerm: "stateful filter" },
  { vendorTerm: "network ACL", opsforgeTerm: "stateless filter" },
  { vendorTerm: "transit gateway", opsforgeTerm: "hub router" },
  { vendorTerm: "SQS", opsforgeTerm: "job queue" },
  { vendorTerm: "SNS", opsforgeTerm: "pub/sub topic" },
  { vendorTerm: "EventBridge", opsforgeTerm: "event router" },
  { vendorTerm: "Step Functions", opsforgeTerm: "workflow state machine" },
  { vendorTerm: "DynamoDB", opsforgeTerm: "managed key-value store" },
  { vendorTerm: "CloudWatch alarm", opsforgeTerm: "metric alarm" },
  { vendorTerm: "SCP", opsforgeTerm: "organisation guardrail policy" },
  { vendorTerm: "Lambda", opsforgeTerm: "function platform" },
  { vendorTerm: "KMS", opsforgeTerm: "key service" },
  { vendorTerm: "IAM policy", opsforgeTerm: "authorization policy" },
];
