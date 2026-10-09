import type { StudyModality } from "../../domain/types.ts";

/**
 * Curated links between Ascendra objectives and the OpsForge work that already
 * teaches them. Entries match an objective by course code and a fragment of
 * its text (case-insensitive); the catalog build fails if a fragment matches
 * no objective or more than one, so a catalog refresh cannot silently drop a
 * link. Only this table decides a "do-existing" label; everything else is
 * "read" until the generation script suggests otherwise and the owner
 * promotes the suggestion here.
 *
 * `coverage` is honest about how much of the objective the mission covers.
 * This file has no runtime imports so the catalog build script (Node) can
 * load it as well as the app.
 */
export interface StudyMissionLink {
  course: string; // Ascendra track code, e.g. "AWSSAA"
  text: string; // fragment of the objective text, matched case-insensitively
  mission: string; // OpsForge mission id
  coverage: "full" | "partial";
  note?: string;
}

/** Objectives a lab exercise makes the learner do. Passing the exercise credits them (format "lab"). */
export interface StudyLabLink {
  course: string;
  text: string;
  lab: string; // lab id, e.g. "policy"
  exerciseId?: string;
  coverage: "full" | "partial";
  note?: string;
}

export interface StudyEngineGate {
  course: string;
  gateText: string; // fragment of the unit's gate sentence
  engine: string; // id in ENGINES (src/content/study/engines.ts)
}

export const STUDY_LINKS: StudyMissionLink[] = [
  // AWS
  { course: "AWSSAA", text: "Caching strategies, including edge caching", mission: "incident-01-cache-stampede", coverage: "partial", note: "cache stampede on the shared engine; no CDN" },
  { course: "AWSSAA", text: "Horizontal scaling versus vertical scaling", mission: "incident-02-traffic-surge", coverage: "full" },
  { course: "AWSSAA", text: "Decoupling with queues and pub/sub", mission: "incident-03-dead-consumers", coverage: "partial", note: "queues only" },
  { course: "AWSSAA", text: "Read replicas, and the specific problem they solve", mission: "incident-04-replica-lag", coverage: "full" },
  { course: "AWSSAA", text: "Designing out single points of failure", mission: "design-01-position-ingest", coverage: "full" },
  { course: "AWSSAA", text: "Service quotas and throttling", mission: "serverless-01-throttled-function", coverage: "full" },
  { course: "AWSDVA", text: "strongly consistent versus eventually consistent", mission: "design-02-command-ack", coverage: "full" },
  { course: "AWSDVA", text: "dead-letter queues", mission: "serverless-02-poison-messages", coverage: "full" },
  { course: "AWSDOP", text: "Building event processing workflows", mission: "serverless-03-duplicate-charges", coverage: "partial", note: "retries and duplicate side effects" },
  { course: "AWSDVA", text: "Writing code against messaging services", mission: "serverless-04-idempotent-handler", coverage: "full" },
  { course: "AWSDVA", text: "retry logic, circuit breakers", mission: "go-04-retries-idempotency", coverage: "partial", note: "retries with backoff and idempotency; timeouts in go-03" },
  { course: "AWSDVA", text: "Synchronous versus asynchronous patterns", mission: "go-02-worker-pool", coverage: "partial" },
  { course: "AWSDVA", text: "Concurrency, defined and then configured", mission: "go-05-data-race", coverage: "partial", note: "defined here; configured in serverless-01" },
  { course: "AWSDVA", text: "Query versus scan", mission: "bigo-03-structures", coverage: "partial", note: "hash lookup versus a full list walk" },
  { course: "AWSDEA", text: "Optimizing code to cut ingestion and transformation runtime", mission: "bigo-01-growth", coverage: "partial" },
  { course: "AWSDVA", text: "Serializing and deserializing data", mission: "python-04-fleet-report", coverage: "full" },
  { course: "AWSDVA", text: "Writing and running unit tests", mission: "python-03-config-validator", coverage: "full" },
  { course: "AWSDOP", text: "metrics from log events with metric filters", mission: "python-02-log-parser", coverage: "partial", note: "the concept, in Python; no metric-filter syntax" },
  { course: "AWSDVA", text: "Querying logs to find the relevant data", mission: "linux-02-log-detective", coverage: "full" },
  { course: "AWSDVA", text: "secret management services rather than secrets in code", mission: "devops-04-secret-wiring", coverage: "full" },
  { course: "AWSDVA", text: "Committing code to a repository to invoke build", mission: "devops-01-broken-pipeline", coverage: "full" },
  { course: "AWSDOP", text: "Running builds and tests on pull requests", mission: "devops-02-green-locally-red-in-ci", coverage: "full" },
  { course: "AWSDVA", text: "Rolling an application back", mission: "devops-03-bad-release-rollback", coverage: "full" },
  { course: "AWSSCS", text: "Containing and eradicating threats", mission: "netsec-02-suspicious-cron", coverage: "full" },
  { course: "AWSSCS", text: "Searching and correlating logs for security events", mission: "netsec-01-brute-force", coverage: "full" },
  // Linux
  { course: "LINUXPLUS", text: "systemd service management", mission: "linux-03-locked-out", coverage: "full" },
  { course: "LINUXPLUS", text: "File permissions and ownership", mission: "linux-03-locked-out", coverage: "partial", note: "no umask" },
  { course: "LINUXPLUS", text: "Diagnosing storage issues", mission: "linux-04-disk-full", coverage: "partial", note: "full disk only" },
  { course: "LINUXPLUS", text: "Diagnosing performance issues", mission: "linux-05-runaway-process", coverage: "full" },
  { course: "LINUXPLUS", text: "Reading and interpreting system logs", mission: "linux-02-log-detective", coverage: "full" },
  { course: "LINUXPLUS", text: "Basic regular expressions with grep", mission: "linux-02-log-detective", coverage: "partial", note: "no awk" },
  { course: "LINUXPLUS", text: "Shell automation scheduling", mission: "linux-05-runaway-process", coverage: "partial", note: "fixes one cron entry" },
  // Python
  { course: "PYTHON", text: "Variables, dynamic typing", mission: "python-01-uptime-report", coverage: "partial" },
  { course: "PYTHON", text: "Input/output with input() and print()", mission: "python-01-uptime-report", coverage: "partial" },
  { course: "PYTHON", text: "Loops: for, while, range()", mission: "python-02-log-parser", coverage: "partial" },
  { course: "PYTHON", text: "Dictionaries: keys, values, items", mission: "python-02-log-parser", coverage: "full" },
  { course: "PYTHON", text: "String methods: splitting, joining", mission: "python-02-log-parser", coverage: "full" },
  { course: "PYTHON", text: "Working with CSV and JSON data", mission: "python-04-fleet-report", coverage: "full" },
  { course: "PYTHON", text: "Exceptions: try/except/else/finally", mission: "python-03-config-validator", coverage: "full" },
  { course: "PYTHON", text: "Catching specific exception types", mission: "python-03-config-validator", coverage: "full" },
  // Algorithms
  { course: "MSCS", text: "Compare constant, logarithmic, linear", mission: "bigo-01-growth", coverage: "partial", note: "no factorial" },
  { course: "MSCS", text: "Analyze simple loop and recursive patterns", mission: "bigo-01-growth", coverage: "partial" },
  { course: "MSCS", text: "hash-table ops are average-case O(1)", mission: "bigo-03-structures", coverage: "full" },
  { course: "MSCS", text: "Compare insertion/merge/quick/heap sort", mission: "bigo-02-search-sort", coverage: "partial" },
  { course: "MSCS", text: "Compare access/search/insert/delete/space cost", mission: "bigo-03-structures", coverage: "partial", note: "search only" },
  { course: "CMPCBS", text: "Internal searching algorithms", mission: "bigo-02-search-sort", coverage: "full" },
  { course: "CMPCBS", text: "Hashing and tree-based searching", mission: "bigo-03-structures", coverage: "partial" },
  // Security
  { course: "SECPLUS", text: "Indicators of compromise and threat-hunting", mission: "netsec-02-suspicious-cron", coverage: "full" },
  { course: "CYSAPLUS", text: "Identity and access monitoring", mission: "netsec-01-brute-force", coverage: "partial" },
  { course: "SECPLUS", text: "Access control models", mission: "netsec-01-brute-force", coverage: "partial", note: "least privilege" },
  { course: "CYSAPLUS", text: "Incident response lifecycle", mission: "netsec-02-suspicious-cron", coverage: "partial" },
  { course: "PENTESTPLUS", text: "Persistence mechanisms", mission: "netsec-02-suspicious-cron", coverage: "partial", note: "the defender's view" },
  { course: "LINUXPLUS", text: "SSH hardening", mission: "netsec-02-suspicious-cron", coverage: "partial", note: "one quiz question" },
  { course: "CYSAPLUS", text: "Threat intelligence", mission: "netsec-02-suspicious-cron", coverage: "partial" },
  { course: "CMPCBS", text: "Defensive strategies and countermeasures", mission: "netsec-02-suspicious-cron", coverage: "partial" },
  // DevOps
  { course: "LINUXPLUS", text: "Version control basics with git", mission: "devops-01-broken-pipeline", coverage: "partial", note: "no git command in the terminal" },
  { course: "SECURITYX", text: "Secure software development lifecycle", mission: "devops-04-secret-wiring", coverage: "partial" },
  { course: "CYSAPLUS", text: "Root cause analysis and post-incident reporting", mission: "devops-03-bad-release-rollback", coverage: "partial" },
  { course: "SECPLUS", text: "Change management and configuration management", mission: "devops-03-bad-release-rollback", coverage: "partial" },
  // Distributed
  { course: "MSCS", text: "Race conditions", mission: "go-05-data-race", coverage: "full" },
  { course: "MSCS", text: "Locks and mutexes", mission: "go-05-data-race", coverage: "full" },
  { course: "MSCS", text: "Threads", mission: "go-02-worker-pool", coverage: "partial", note: "goroutines" },
  { course: "MSCS", text: "Deadlocks and the four necessary conditions", mission: "go-02-worker-pool", coverage: "partial", note: "the four conditions are not taught" },
  { course: "MSCS", text: "Replication and partitioning", mission: "incident-04-replica-lag", coverage: "partial", note: "replication only" },
  { course: "MSCS", text: "Consistency/latency tradeoffs", mission: "design-02-command-ack", coverage: "full" },
  { course: "SECPLUS", text: "High availability and resilience design", mission: "design-01-position-ingest", coverage: "full" },
];

const POLICY_LAB_LINKS: StudyLabLink[] = [
  // Authorization policy lab (/labs/policy)
  { course: "AWSSAA", text: "A flexible authorization model built from IAM users, groups, roles, and policies", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial", note: "policies and the evaluation rules; no users, groups or roles" },
  { course: "AWSSAA", text: "Resource-based policies, and when they beat an identity-based policy", lab: "policy", exerciseId: "policy-05-cross-account", coverage: "full" },
  { course: "AWSSAA", text: "Security across many accounts: AWS Organizations", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "partial", note: "guardrail policies only" },
  { course: "AWSCLF", text: "Managed policies versus custom policies, written to least privilege", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial", note: "writing a narrow allow" },
  { course: "AWSDEA", text: "Constructing custom policies that hold to least privilege", lab: "policy", exerciseId: "policy-02-deny-wins", coverage: "partial" },
  { course: "AWSDOP", text: "Service control policies in AWS Organizations", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "full" },
  { course: "AWSDOP", text: "Designing policies that enforce least privilege access", lab: "policy", exerciseId: "policy-03-boundary", coverage: "partial" },
  { course: "AWSSOA", text: "Implementing IAM features: password policies, MFA, roles, federated identity, resource policies, policy conditions", lab: "policy", exerciseId: "policy-06-tags", coverage: "partial", note: "resource policies and conditions" },
  { course: "AWSSOA", text: "Troubleshooting and auditing access with CloudTrail, IAM Access Analyzer, and the IAM policy simulator", lab: "policy", exerciseId: "policy-02-deny-wins", coverage: "partial", note: "the decision trace plays the simulator's part" },
  { course: "AWSSOA", text: "Implementing multi-account strategies securely", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "partial", note: "guardrails only" },
  { course: "AWSSCS", text: "Designing authorization controls", lab: "policy", exerciseId: "policy-05-cross-account", coverage: "partial", note: "resource policies for cross-account access" },
  { course: "AWSSCS", text: "Designing attribute-based and role-based access control", lab: "policy", exerciseId: "policy-06-tags", coverage: "full" },
  { course: "AWSSCS", text: "implementing IAM policies to least privilege, including permissions boundaries", lab: "policy", exerciseId: "policy-03-boundary", coverage: "full" },
  { course: "AWSSCS", text: "Analyzing authorization failures with the IAM policy simulator", lab: "policy", exerciseId: "policy-02-deny-wins", coverage: "full" },
  { course: "AWSSCS", text: "Investigating and correcting unintended permissions granted to a resource", lab: "policy", exerciseId: "policy-03-boundary", coverage: "partial" },
  { course: "AWSSCS", text: "Organization policies that manage permissions: service control policies", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "partial" },
  { course: "AWSSAP", text: "Specifying IAM users and roles that hold to least privilege", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial" },
  { course: "AWSMLA", text: "Configuring IAM policies and roles for users and applications in ML", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial" },
];

export const NETWORK_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSSAA", text: "VPC security components: security groups, network ACLs, route tables, NAT gateways", lab: "network", exerciseId: "net-01-stateful-source", coverage: "full" },
  { course: "AWSSAA", text: "Network segmentation with public and private subnets", lab: "network", exerciseId: "net-03-nat", coverage: "full" },
  { course: "AWSSAA", text: "AWS service endpoints and private access with AWS PrivateLink and VPC endpoints", lab: "network", exerciseId: "net-04-endpoint", coverage: "partial", note: "endpoint routing; no endpoint policies" },
  { course: "AWSSAA", text: "Network topology design: subnet tiers, routing, IP addressing", lab: "network", exerciseId: "net-05-hub", coverage: "partial" },
  { course: "AWSCLF", text: "VPC components: subnets, route tables, internet gateways, NAT gateways", lab: "network", exerciseId: "net-03-nat", coverage: "full" },
  { course: "AWSCLF", text: "Security inside a VPC: security groups versus network ACLs", lab: "network", exerciseId: "net-02-stateless-reply", coverage: "full" },
  { course: "AWSSOA", text: "Configuring a VPC: subnets, route tables, network ACLs, security groups, NAT gateways", lab: "network", exerciseId: "net-03-nat", coverage: "partial" },
  { course: "AWSSOA", text: "Configuring private connectivity: VPC endpoints, AWS PrivateLink, VPC peering", lab: "network", exerciseId: "net-04-endpoint", coverage: "partial" },
  { course: "AWSSOA", text: "Troubleshooting VPC configurations: subnets, route tables, network ACLs, security groups, transit gateways, NAT gateways", lab: "network", exerciseId: "net-01-stateful-source", coverage: "full" },
  { course: "AWSSOA", text: "Collecting and interpreting networking logs: VPC flow logs", lab: "network", exerciseId: "net-02-stateless-reply", coverage: "partial", note: "flow-log style verdicts per hop" },
  { course: "AWSANS", text: "Configuring a hub-and-spoke architecture with Transit Gateway", lab: "network", exerciseId: "net-05-hub", coverage: "partial" },
  { course: "AWSANS", text: "Implementing security between network boundaries with security groups, network ACLs", lab: "network", exerciseId: "net-06-rule-order", coverage: "partial" },
  { course: "AWSANS", text: "Using route tables and automatic propagation to direct traffic", lab: "network", exerciseId: "net-05-hub", coverage: "partial", note: "no propagation" },
  { course: "AWSANS", text: "Troubleshooting connectivity caused by misconfiguration with Reachability Analyzer", lab: "network", exerciseId: "net-01-stateful-source", coverage: "partial", note: "the trace plays the analyzer's part" },
  { course: "AWSANS", text: "Private application connectivity with AWS PrivateLink", lab: "network", exerciseId: "net-04-endpoint", coverage: "partial" },
  { course: "AWSANS", text: "Creating and analyzing VPC flow logs, including base and extended fields", lab: "network", exerciseId: "net-02-stateless-reply", coverage: "partial", note: "verdict lines only" },
  { course: "AWSDOP", text: "Network security components: security groups, network ACLs, routing", lab: "network", exerciseId: "net-06-rule-order", coverage: "partial" },
  { course: "AWSSAP", text: "Specifying inbound and outbound network flows with security group and network ACL rules", lab: "network", exerciseId: "net-02-stateless-reply", coverage: "full" },
  { course: "AWSSAP", text: "Route tables, security groups, and network ACLs as organization-wide controls", lab: "network", exerciseId: "net-06-rule-order", coverage: "partial" },
  { course: "AWSSCS", text: "Designing and troubleshooting network controls that permit or prevent traffic: security groups, network ACLs", lab: "network", exerciseId: "net-01-stateful-source", coverage: "full" },
  { course: "AWSSCS", text: "Network segmentation from security requirements: north/south and east/west protection, isolated subnets", lab: "network", exerciseId: "net-04-endpoint", coverage: "partial" },
  { course: "AWSDEA", text: "Updating VPC security groups to permit data access", lab: "network", exerciseId: "net-01-stateful-source", coverage: "full" },
  { course: "AWSMLA", text: "Creating VPCs, subnets, and security groups that isolate ML and AI systems", lab: "network", exerciseId: "net-04-endpoint", coverage: "partial" },
];

export const DR_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSSAA", text: "Disaster recovery strategies: backup and restore, pilot light, warm standby, active-active failover", lab: "dr", exerciseId: "dr-02-order-api", coverage: "full" },
  { course: "AWSSAA", text: "RTO and RPO, and letting them choose the DR strategy", lab: "dr", exerciseId: "dr-01-match-the-need", coverage: "full" },
  { course: "AWSSAA", text: "Failover strategies and the health checks that trigger them", lab: "dr", exerciseId: "dr-03-payments", coverage: "partial", note: "manual versus automatic trigger" },
  { course: "AWSSAA", text: "Selecting a backup or archival solution on cost", lab: "dr", exerciseId: "dr-01-match-the-need", coverage: "partial" },
  { course: "AWSSAA", text: "Backup and retention policy design, including snapshot frequency", lab: "dr", exerciseId: "dr-02-order-api", coverage: "partial", note: "snapshot frequency as the recovery point" },
  { course: "AWSCLF", text: "When a workload needs multiple Regions: disaster recovery", lab: "dr", exerciseId: "dr-01-match-the-need", coverage: "partial" },
  { course: "AWSSOA", text: "Restoring databases, including point-in-time restore, against RTO, RPO, and cost requirements", lab: "dr", exerciseId: "dr-05-restore-dominates", coverage: "partial", note: "restore time against the objectives" },
  { course: "AWSSOA", text: "Following disaster recovery procedures: backup and restore, pilot light, warm standby", lab: "dr", exerciseId: "dr-04-untested", coverage: "partial" },
  { course: "AWSDOP", text: "Disaster recovery concepts and strategies that meet RTO and RPO", lab: "dr", exerciseId: "dr-02-order-api", coverage: "full" },
  { course: "AWSDOP", text: "Testing failover of Multi-AZ and multi-Region workloads", lab: "dr", exerciseId: "dr-04-untested", coverage: "partial", note: "the restore drill" },
  { course: "AWSSAP", text: "Designing disaster recovery to stated RTO and RPO", lab: "dr", exerciseId: "dr-03-payments", coverage: "partial" },
  { course: "AWSSAP", text: "Disaster recovery patterns at scale: pilot light, warm standby, multi-site", lab: "dr", exerciseId: "dr-02-order-api", coverage: "partial" },
  { course: "AWSSAP", text: "Designing an effective backup and restoration strategy", lab: "dr", exerciseId: "dr-05-restore-dominates", coverage: "full" },
  { course: "AWSSAP", text: "Performing disaster recovery testing rather than assuming it works", lab: "dr", exerciseId: "dr-04-untested", coverage: "full" },
  { course: "AWSSAP", text: "Architecting automated, cost-effective backup", lab: "dr", exerciseId: "dr-01-match-the-need", coverage: "partial" },
  { course: "SECPLUS", text: "Business continuity and disaster recovery: BIA, RTO/RPO, backup types, DR sites", lab: "dr", exerciseId: "dr-02-order-api", coverage: "partial", note: "RTO/RPO and standby sites" },
  { course: "SECURITYX", text: "Business continuity and disaster recovery at an enterprise architecture level", lab: "dr", exerciseId: "dr-05-restore-dominates", coverage: "partial" },
];

export const ALARM_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSSOA", text: "Configuring CloudWatch alarms, including composite alarms", lab: "alarms", exerciseId: "alarm-06-severity", coverage: "partial", note: "thresholds, periods and composite conditions; no actions" },
  { course: "AWSSOA", text: "Troubleshooting an alarm that never fires, or fires on the wrong thing", lab: "alarms", exerciseId: "alarm-03-right-metric", coverage: "full" },
  { course: "AWSSOA", text: "Analyzing performance metrics and automating remediation", lab: "alarms", exerciseId: "alarm-01-threshold", coverage: "partial", note: "reading the metrics; no remediation" },
  { course: "AWSSOA", text: "Monitoring Amazon RDS with Performance Insights and CloudWatch alarms", lab: "alarms", exerciseId: "alarm-04-replica", coverage: "partial", note: "replica lag and database saturation" },
  { course: "AWSSOA", text: "Monitoring different workload shapes -- serverless, compute, AI", lab: "alarms", exerciseId: "alarm-05-function", coverage: "partial", note: "function throttling versus cold starts" },
  { course: "AWSDOP", text: "Common metrics and logs that signal trouble", lab: "alarms", exerciseId: "alarm-03-right-metric", coverage: "partial" },
  { course: "AWSDOP", text: "Associating CloudWatch alarms with standard and custom metrics", lab: "alarms", exerciseId: "alarm-01-threshold", coverage: "partial" },
  { course: "AWSDOP", text: "Alert notification and action capabilities", lab: "alarms", exerciseId: "alarm-06-severity", coverage: "partial", note: "severity tiers; no notification wiring" },
  { course: "AWSDVA", text: "Interpreting application metrics, logs, and traces together", lab: "alarms", exerciseId: "alarm-02-periods", coverage: "partial" },
  { course: "AWSDVA", text: "Reviewing application health with dashboards and insights", lab: "alarms", exerciseId: "alarm-04-replica", coverage: "partial" },
  { course: "AWSANS", text: "Implementing automated alarms and custom metrics with CloudWatch", lab: "alarms", exerciseId: "alarm-02-periods", coverage: "partial" },
  { course: "AWSANS", text: "Recommending the metrics that give the clearest visibility", lab: "alarms", exerciseId: "alarm-03-right-metric", coverage: "partial" },
  { course: "AWSSAP", text: "Centralized monitoring that recovers proactively from system failures", lab: "alarms", exerciseId: "alarm-06-severity", coverage: "partial" },
  { course: "AWSSAP", text: "Determining the most appropriate logging and monitoring strategy", lab: "alarms", exerciseId: "alarm-01-threshold", coverage: "partial" },
  { course: "AWSMLA", text: "Monitoring workflows for anomalies and errors in data processing or model inference", lab: "alarms", exerciseId: "alarm-02-periods", coverage: "partial" },
  { course: "AWSDEA", text: "Using notifications during monitoring to send alerts", lab: "alarms", exerciseId: "alarm-06-severity", coverage: "partial" },
];

export const COST_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSCLF", text: "Fixed costs versus variable costs", lab: "cost", exerciseId: "cost-02-commit-baseline", coverage: "partial" },
  { course: "AWSCLF", text: "Rightsizing, and why it is a recurring exercise", lab: "cost", exerciseId: "cost-01-rightsize", coverage: "full" },
  { course: "AWSCLF", text: "Compute purchasing options: On-Demand, Reserved Instances, Spot Instances", lab: "cost", exerciseId: "cost-03-interruptible", coverage: "partial", note: "committed, on-demand and interruptible capacity in generic terms" },
  { course: "AWSCLF", text: "Data transfer costs: inbound, outbound, Region to Region, and within a Region", lab: "cost", exerciseId: "cost-05-transfer-path", coverage: "partial" },
  { course: "AWSCLF", text: "Pricing across storage options and tiers", lab: "cost", exerciseId: "cost-04-tiering", coverage: "partial" },
  { course: "AWSCLF", text: "AWS Budgets and AWS Cost Explorer, and which question each answers", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "partial", note: "a spend alarm and allocation tags" },
  { course: "AWSCLF", text: "Cost allocation tags and the AWS Cost and Usage Report", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "partial" },
  { course: "AWSSAA", text: "Selecting the most cost-effective storage service for a workload", lab: "cost", exerciseId: "cost-04-tiering", coverage: "partial" },
  { course: "AWSSAA", text: "Purchasing options on cost: On-Demand, Spot Instances, Reserved Instances, Savings Plans", lab: "cost", exerciseId: "cost-02-commit-baseline", coverage: "partial" },
  { course: "AWSSAA", text: "Selecting instance family and size for cost", lab: "cost", exerciseId: "cost-01-rightsize", coverage: "partial", note: "size only" },
  { course: "AWSSAA", text: "NAT gateway cost: one shared gateway versus one per Availability Zone", lab: "cost", exerciseId: "cost-05-transfer-path", coverage: "full" },
  { course: "AWSSAA", text: "Routing that minimizes transfer cost: VPC endpoints, VPC peering", lab: "cost", exerciseId: "cost-05-transfer-path", coverage: "partial" },
  { course: "AWSSAA", text: "CDN and edge caching to cut origin cost", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "full" },
  { course: "AWSSAA", text: "Cost visibility: AWS Cost Explorer, AWS Budgets, the AWS Cost and Usage Report, cost allocation tags", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "partial" },
  { course: "AWSSAP", text: "Purchasing options and their effect on cost and performance", lab: "cost", exerciseId: "cost-03-interruptible", coverage: "partial" },
  { course: "AWSSAP", text: "Designing a rightsizing strategy", lab: "cost", exerciseId: "cost-01-rightsize", coverage: "partial" },
  { course: "AWSSAP", text: "Identifying appropriate pricing models: Reserved Instances and AWS Savings Plans", lab: "cost", exerciseId: "cost-02-commit-baseline", coverage: "partial" },
  { course: "AWSSAP", text: "Storage tiering and data transfer modeling to reduce cost", lab: "cost", exerciseId: "cost-04-tiering", coverage: "partial" },
  { course: "AWSSAP", text: "Designing billing alarms based on expected usage patterns", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "partial" },
  { course: "AWSSAP", text: "Using tagging for cost allocation and reporting", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "partial" },
  { course: "AWSSOA", text: "Optimizing the cost of a network architecture", lab: "cost", exerciseId: "cost-05-transfer-path", coverage: "partial" },
  { course: "AWSMLA", text: "Cutting infrastructure cost through purchasing options", lab: "cost", exerciseId: "cost-03-interruptible", coverage: "partial" },
  { course: "AWSMLA", text: "Balancing on-demand against provisioned resources for performance and cost", lab: "cost", exerciseId: "cost-02-commit-baseline", coverage: "partial" },
  { course: "AWSDEA", text: "Optimizing cost while processing data", lab: "cost", exerciseId: "cost-03-interruptible", coverage: "partial" },
  { course: "AWSSCS", text: "Using tags to group resources by department, cost center, and environment", lab: "cost", exerciseId: "cost-06-cache-and-alarm", coverage: "partial" },
];

export const DEPLOY_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSDVA", text: "Configuring deployment strategies: blue/green, canary, rolling", lab: "deploy", exerciseId: "deploy-02-canary", coverage: "full" },
  { course: "AWSDOP", text: "Determining a deployment strategy", lab: "deploy", exerciseId: "deploy-01-all-at-once", coverage: "partial", note: "the strategies themselves; no deployment service" },
  { course: "AWSDOP", text: "Mutable deployment patterns against immutable ones", lab: "deploy", exerciseId: "deploy-04-blue-green", coverage: "partial", note: "a second fleet as the immutable pattern" },
  { course: "AWSDOP", text: "Using blue/green and canary deployment methods", lab: "deploy", exerciseId: "deploy-03-latent-defect", coverage: "full" },
  { course: "AWSDOP", text: "Analyzing failed deployments", lab: "deploy", exerciseId: "deploy-06-guard", coverage: "partial", note: "why a guarded rollout did not roll back" },
  { course: "AWSSOA", text: "Implementing deployment strategies and the services that carry them out", lab: "deploy", exerciseId: "deploy-05-too-slow", coverage: "partial" },
  { course: "AWSSAP", text: "Selecting services for deployment strategies and appropriate rollback mechanisms", lab: "deploy", exerciseId: "deploy-06-guard", coverage: "partial", note: "rollback mechanisms" },
  { course: "AWSSAP", text: "Deployment strategies already in place: blue/green, all-at-once, rolling", lab: "deploy", exerciseId: "deploy-01-all-at-once", coverage: "full" },
  { course: "AWSSAA", text: "Immutable infrastructure and automation that keeps infrastructure integrity", lab: "deploy", exerciseId: "deploy-04-blue-green", coverage: "partial" },
  { course: "AWSMLA", text: "Automated deployment strategies and rollback actions", lab: "deploy", exerciseId: "deploy-02-canary", coverage: "partial" },
];

export const CRYPTO_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSSAA", text: "Encrypting data at rest with AWS KMS, and writing key policies that hold", lab: "crypto", exerciseId: "crypto-04-cross-account", coverage: "full" },
  { course: "AWSSAA", text: "Rotating encryption keys and renewing certificates before they expire", lab: "crypto", exerciseId: "crypto-05-rotation", coverage: "partial", note: "key rotation; certificates are not simulated" },
  { course: "AWSDVA", text: "Encryption at rest and encryption in transit, defined precisely", lab: "crypto", exerciseId: "crypto-02-direct", coverage: "partial", note: "the at-rest half" },
  { course: "AWSDVA", text: "Client-side encryption versus server-side encryption", lab: "crypto", exerciseId: "crypto-02-direct", coverage: "full" },
  { course: "AWSDVA", text: "Using encryption keys to encrypt and decrypt data", lab: "crypto", exerciseId: "crypto-01-envelope", coverage: "full" },
  { course: "AWSDVA", text: "Using encryption across account boundaries", lab: "crypto", exerciseId: "crypto-04-cross-account", coverage: "full" },
  { course: "AWSDVA", text: "Enabling and disabling key rotation", lab: "crypto", exerciseId: "crypto-05-rotation", coverage: "partial", note: "rotation and versions; no disabling" },
  { course: "AWSDVA", text: "Encrypting environment variables that contain sensitive data", lab: "crypto", exerciseId: "crypto-02-direct", coverage: "partial", note: "a small secret sealed directly" },
  { course: "AWSSOA", text: "Implementing, configuring, and troubleshooting encryption at rest with AWS KMS", lab: "crypto", exerciseId: "crypto-03-unwrap", coverage: "partial" },
  { course: "AWSDEA", text: "Using AWS KMS keys to encrypt and decrypt data", lab: "crypto", exerciseId: "crypto-01-envelope", coverage: "full" },
  { course: "AWSDEA", text: "Configuring encryption across AWS account boundaries", lab: "crypto", exerciseId: "crypto-04-cross-account", coverage: "full" },
  { course: "AWSSAP", text: "Developing encryption strategies for data at rest and in transit", lab: "crypto", exerciseId: "crypto-02-direct", coverage: "partial", note: "at rest: direct against envelope" },
  { course: "AWSSAP", text: "Deploying encryption strategies for data at rest and in transit with AWS KMS and AWS Certificate Manager", lab: "crypto", exerciseId: "crypto-01-envelope", coverage: "partial", note: "the at-rest half" },
  { course: "AWSDOP", text: "Data management: classification, encryption, key management, access controls", lab: "crypto", exerciseId: "crypto-06-separation", coverage: "partial", note: "key management and access controls" },
  { course: "AWSDOP", text: "Encrypting data in transit and at rest with AWS KMS, AWS CloudHSM, and AWS Certificate Manager", lab: "crypto", exerciseId: "crypto-05-rotation", coverage: "partial", note: "the at-rest half" },
  { course: "AWSSCS", text: "Encryption at rest: choosing between AWS KMS and AWS CloudHSM, and client-side against server-side encryption", lab: "crypto", exerciseId: "crypto-02-direct", coverage: "partial", note: "client-side against server-side" },
  { course: "AWSSCS", text: "Creating and managing encryption keys and certificates across one or many Regions", lab: "crypto", exerciseId: "crypto-05-rotation", coverage: "partial", note: "key versions and policies; no regions or certificates" },
  { course: "AWSCLF", text: "Encryption at rest and encryption in transit as two separate decisions", lab: "crypto", exerciseId: "crypto-01-envelope", coverage: "partial", note: "the at-rest half" },
];

export const MESSAGING_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSSAA", text: "Decoupling workloads so components scale independently", lab: "messaging", exerciseId: "msg-01-decouple", coverage: "full" },
  { course: "AWSSAA", text: "Designing streaming ingestion with Amazon Kinesis", lab: "messaging", exerciseId: "msg-06-stream", coverage: "partial", note: "shards and partition keys; no service" },
  { course: "AWSDVA", text: "Architectural patterns in application code: event-driven, microservices, monolithic, choreography, orchestration, fanout", lab: "messaging", exerciseId: "msg-05-fanout", coverage: "partial", note: "fan-out and event-driven" },
  { course: "AWSDVA", text: "Tightly coupled versus loosely coupled components", lab: "messaging", exerciseId: "msg-01-decouple", coverage: "full" },
  { course: "AWSDVA", text: "Handling streaming data with AWS services", lab: "messaging", exerciseId: "msg-06-stream", coverage: "partial" },
  { course: "AWSSOA", text: "Sending notifications to Amazon SNS from AWS services and from alarms", lab: "messaging", exerciseId: "msg-05-fanout", coverage: "partial", note: "a topic with filtered subscriptions" },
  { course: "AWSDEA", text: "Reading from streaming sources", lab: "messaging", exerciseId: "msg-06-stream", coverage: "partial" },
  { course: "AWSDEA", text: "Throttling and rate limits in DynamoDB, Amazon RDS, and Kinesis, and how to work within them", lab: "messaging", exerciseId: "msg-06-stream", coverage: "partial", note: "per-shard capacity and a hot key" },
  { course: "AWSDEA", text: "Managing fan-in and fan-out for streaming data distribution", lab: "messaging", exerciseId: "msg-05-fanout", coverage: "full" },
  { course: "AWSDEA", text: "Sending alerts from a pipeline with Amazon SNS and Amazon SQS", lab: "messaging", exerciseId: "msg-02-poison", coverage: "partial", note: "the queue half" },
  { course: "AWSMLA", text: "Ingesting from AWS streaming sources", lab: "messaging", exerciseId: "msg-06-stream", coverage: "partial" },
  { course: "AWSSAP", text: "Implementing loosely coupled dependencies with Amazon SNS, Amazon SQS, and AWS Step Functions", lab: "messaging", exerciseId: "msg-03-redelivery", coverage: "partial", note: "queues and topics; no workflow yet" },
  { course: "AWSSAP", text: "Identifying opportunities to decouple application components", lab: "messaging", exerciseId: "msg-01-decouple", coverage: "full" },
  { course: "AWSSAP", text: "Selecting the appropriate application integration service", lab: "messaging", exerciseId: "msg-04-order", coverage: "partial", note: "queue, topic or stream by the guarantees needed" },
  { course: "AWSDOP", text: "Event-driven architectures: fan-out, event streaming, queuing", lab: "messaging", exerciseId: "msg-05-fanout", coverage: "full" },
  { course: "AWSCLF", text: "Application integration: Amazon SQS, Amazon SNS, Amazon EventBridge", lab: "messaging", exerciseId: "msg-01-decouple", coverage: "partial", note: "what a queue and a topic are for" },
];

export const AUTOSCALE_LAB_LINKS: StudyLabLink[] = [
  { course: "AWSCLF", text: "Auto scaling as the mechanism that delivers elasticity", lab: "autoscale", exerciseId: "as-01-elastic", coverage: "full" },
  { course: "AWSSAA", text: "the metrics and conditions that trigger scaling", lab: "autoscale", exerciseId: "as-06-metric", coverage: "full" },
  { course: "AWSSAA", text: "Scaling methods that cut spend", lab: "autoscale", exerciseId: "as-01-elastic", coverage: "partial", note: "scaling in when demand falls; no hibernation" },
  { course: "AWSDVA", text: "Configuring application health checks and readiness probes", lab: "autoscale", exerciseId: "as-05-health", coverage: "partial", note: "balancer health checks; readiness is the warm-up" },
  { course: "AWSSOA", text: "Configuring and managing scaling mechanisms in compute environments", lab: "autoscale", exerciseId: "as-02-warmup", coverage: "full" },
  { course: "AWSSOA", text: "Configuring and troubleshooting Elastic Load Balancing health checks", lab: "autoscale", exerciseId: "as-05-health", coverage: "full" },
  { course: "AWSMLA", text: "Selecting the metrics that drive auto scaling", lab: "autoscale", exerciseId: "as-06-metric", coverage: "full" },
  { course: "AWSMLA", text: "Optimizing capacity for cost, performance, and reliability", lab: "autoscale", exerciseId: "as-01-elastic", coverage: "partial" },
  { course: "AWSSAP", text: "Auto scaling policies and events", lab: "autoscale", exerciseId: "as-04-thrash", coverage: "full" },
  { course: "AWSSAP", text: "Designing an elastic architecture from business objectives", lab: "autoscale", exerciseId: "as-03-flash-sale", coverage: "partial", note: "a known surge scheduled ahead" },
  { course: "AWSDOP", text: "Choosing the metrics that should drive scaling", lab: "autoscale", exerciseId: "as-06-metric", coverage: "full" },
  { course: "AWSDOP", text: "Identifying and remediating scaling issues", lab: "autoscale", exerciseId: "as-02-warmup", coverage: "full" },
  { course: "AWSDOP", text: "Selecting auto scaling, load balancing, and caching solutions for the workload", lab: "autoscale", exerciseId: "as-04-thrash", coverage: "partial", note: "the scaling policy half" },
  { course: "AWSDOP", text: "Configuring health checks in Application Load Balancer target groups", lab: "autoscale", exerciseId: "as-05-health", coverage: "partial", note: "balancer health checks only" },
  { course: "AWSDOP", text: "Auto scaling capabilities across services", lab: "autoscale", exerciseId: "as-03-flash-sale", coverage: "partial", note: "a compute fleet only" },
  { course: "AWSANS", text: "Integrating auto scaling with load balancing", lab: "autoscale", exerciseId: "as-05-health", coverage: "partial" },
  { course: "AWSSCS", text: "Designing workload monitoring strategies, including resource health checks", lab: "autoscale", exerciseId: "as-05-health", coverage: "partial", note: "the health-check half" },
];

export const SQL_LAB_LINKS: StudyLabLink[] = [
  { course: "MSCS", text: "Relational model", lab: "sql", exerciseId: "sql-01-join", coverage: "full" },
  { course: "MSCS", text: "Normalization through 3NF", lab: "sql", exerciseId: "sql-03-normalise", coverage: "full" },
  { course: "MSCS", text: "Indexes and B-trees", lab: "sql", exerciseId: "sql-02-index", coverage: "full" },
  { course: "MSCS", text: "Transactions and ACID", lab: "sql", exerciseId: "sql-04-transaction", coverage: "full" },
  { course: "MSCS", text: "Query planning (conceptual)", lab: "sql", exerciseId: "sql-06-plan", coverage: "full" },
  { course: "AWSDEA", text: "Indexing, partitioning strategies, compression, and other data optimization techniques", lab: "sql", exerciseId: "sql-02-index", coverage: "partial", note: "indexing" },
  { course: "AWSDEA", text: "Using SQL in Amazon Redshift and Athena to query data and create views", lab: "sql", exerciseId: "sql-05-view", coverage: "full", note: "the SQL, on SQLite" },
  { course: "AWSDEA", text: "Querying data with Amazon Athena", lab: "sql", exerciseId: "sql-01-join", coverage: "partial", note: "the SQL half" },
  { course: "AWSDEA", text: "Stateful versus stateless data transactions", lab: "sql", exerciseId: "sql-04-transaction", coverage: "partial" },
  { course: "AWSDEA", text: "Languages and frameworks for data engineering", lab: "sql", exerciseId: "sql-01-join", coverage: "partial", note: "SQL" },
  { course: "AWSCLF", text: "Relational databases: Amazon RDS and Amazon Aurora", lab: "sql", exerciseId: "sql-01-join", coverage: "partial", note: "what relational means" },
  { course: "AWSSAA", text: "Choosing a database type: relational, non-relational, in-memory, serverless", lab: "sql", exerciseId: "sql-03-normalise", coverage: "partial", note: "the relational option" },
  { course: "CMPCBS", text: "Networking and database fundamentals", lab: "sql", exerciseId: "sql-01-join", coverage: "partial", note: "the database half" },
];

export const PYTHON_DRILL_LINKS: StudyLabLink[] = [
  { course: "PYTHON", text: "Operators: arithmetic, comparison, logical, and operator precedence", lab: "python-drills", exerciseId: "py-01-truthiness", coverage: "full" },
  { course: "PYTHON", text: "Conditional logic: if/elif/else and truthiness", lab: "python-drills", exerciseId: "py-01-truthiness", coverage: "full" },
  { course: "PYTHON", text: "Defining functions: positional, keyword, default, and *args/**kwargs parameters", lab: "python-drills", exerciseId: "py-02-arguments", coverage: "full" },
  { course: "PYTHON", text: "Return values vs. side effects", lab: "python-drills", exerciseId: "py-12-decorators", coverage: "partial", note: "a wrapper that forgets to return" },
  { course: "PYTHON", text: "Local, enclosing, and global scope (the LEGB rule)", lab: "python-drills", exerciseId: "py-03-closures", coverage: "full" },
  { course: "PYTHON", text: "Recursion: base case, recursive case, and stack depth limits", lab: "python-drills", exerciseId: "py-04-recursion", coverage: "full" },
  { course: "PYTHON", text: "The mutable-default-argument pitfall and how to avoid it", lab: "python-drills", exerciseId: "py-05-mutable-default", coverage: "full" },
  { course: "PYTHON", text: "Lists: indexing, slicing, mutation, and common methods", lab: "python-drills", exerciseId: "py-06-slicing", coverage: "full" },
  { course: "PYTHON", text: "Tuples and immutability; when to prefer a tuple over a list", lab: "python-drills", exerciseId: "py-06-slicing", coverage: "full" },
  { course: "PYTHON", text: "Sets: membership testing and set operations", lab: "python-drills", exerciseId: "py-07-sets", coverage: "full" },
  { course: "PYTHON", text: "List, dict, and set comprehensions", lab: "python-drills", exerciseId: "py-08-comprehensions", coverage: "full" },
  { course: "PYTHON", text: "Nested data structures (lists of dicts, dicts of lists)", lab: "python-drills", exerciseId: "py-08-comprehensions", coverage: "full" },
  { course: "PYTHON", text: "Reading and writing text files; the with statement and context managers", lab: "python-drills", exerciseId: "py-14-stdlib-files", coverage: "full" },
  { course: "PYTHON", text: "Classes, instances, attributes, and methods", lab: "python-drills", exerciseId: "py-09-classes", coverage: "full" },
  { course: "PYTHON", text: "__init__, self, and instance vs. class attributes", lab: "python-drills", exerciseId: "py-09-classes", coverage: "full" },
  { course: "PYTHON", text: "Inheritance, method overriding, and super()", lab: "python-drills", exerciseId: "py-10-inheritance", coverage: "full" },
  { course: "PYTHON", text: "Composition vs. inheritance", lab: "python-drills", exerciseId: "py-10-inheritance", coverage: "full" },
  { course: "PYTHON", text: "Common dunder methods: __str__, __repr__, __eq__, __len__", lab: "python-drills", exerciseId: "py-09-classes", coverage: "partial", note: "__repr__ and __eq__" },
  { course: "PYTHON", text: "Useful standard library modules: os, sys, datetime, collections, itertools", lab: "python-drills", exerciseId: "py-14-stdlib-files", coverage: "partial", note: "heapq and the file API" },
  { course: "PYTHON", text: "Iterators and the iterator protocol", lab: "python-drills", exerciseId: "py-11-generators", coverage: "full" },
  { course: "PYTHON", text: "Generators and yield; generator expressions", lab: "python-drills", exerciseId: "py-11-generators", coverage: "full" },
  { course: "PYTHON", text: "First-class functions: passing functions as arguments, lambda expressions", lab: "python-drills", exerciseId: "py-12-decorators", coverage: "full" },
  { course: "PYTHON", text: "Closures and what they actually capture", lab: "python-drills", exerciseId: "py-03-closures", coverage: "full" },
  { course: "PYTHON", text: "Decorators: what they are, how to write one, common built-in examples", lab: "python-drills", exerciseId: "py-12-decorators", coverage: "full" },
  { course: "PYTHON", text: "Debugging techniques: reading tracebacks", lab: "python-drills", exerciseId: "py-05-mutable-default", coverage: "partial", note: "the interpreter's own messages on every failed test" },
  { course: "PYTHON", text: "Type hints: basic annotations, Optional, List/Dict generics, and static checking with mypy", lab: "python-drills", exerciseId: "py-13-typing", coverage: "partial", note: "annotations; no checker runs" },
  { course: "MSCS", text: "Trace recursion and identify base cases", lab: "python-drills", exerciseId: "py-04-recursion", coverage: "full" },
  { course: "CMPCBS", text: "Object-oriented programming basics", lab: "python-drills", exerciseId: "py-09-classes", coverage: "partial", note: "in Python" },
  { course: "CMPCBS", text: "Recursive programming", lab: "python-drills", exerciseId: "py-04-recursion", coverage: "partial", note: "in Python" },
  { course: "CMPCBS", text: "Recursion as a problem-solving technique", lab: "python-drills", exerciseId: "py-04-recursion", coverage: "partial", note: "in Python" },
];

const js = (text: string, exerciseId: string, coverage: "full" | "partial" = "full", note?: string): StudyLabLink => ({ course: "JAVASCRIPT", text, lab: "javascript", exerciseId, coverage, ...(note ? { note } : {}) });

export const JS_LAB_LINKS: StudyLabLink[] = [
  js("Variables: var vs. let vs. const, and why hoisting makes var risky", "js-01-hoisting"),
  js("Primitive types, typeof, and type coercion pitfalls", "js-02-coercion"),
  js("Operators and expressions; operator precedence", "js-02-coercion", "partial", "comparison and logical operators"),
  js("Conditional logic: if/else, switch, and the ternary operator", "js-02-coercion"),
  js("Loops: for, while, for...of, for...in, and when to use each", "js-03-loops"),
  js("Function declarations vs. function expressions vs. arrow functions", "js-04-parameters"),
  js("Parameters: default values, rest parameters", "js-04-parameters"),
  js("Scope: function scope vs. block scope, and the temporal dead zone", "js-01-hoisting"),
  js("Closures: what they capture and a real use case for one", "js-06-closures"),
  js("Understanding `this` in different call contexts", "js-05-this"),
  js("Object literals, property access, and shorthand syntax", "js-08-destructuring", "partial"),
  js("Array methods: map, filter, reduce, find, some, every", "js-07-array-methods"),
  js("Destructuring assignment for objects and arrays", "js-08-destructuring"),
  js("Spread and rest syntax in object/array contexts", "js-08-destructuring"),
  js("Shallow vs. deep copying, and why reference semantics matter", "js-09-copying"),
  js("The event loop, call stack, and task queue", "js-10-event-loop"),
  js("Callbacks and callback hell", "js-11-promises"),
  js("Promises: states, .then/.catch/.finally, Promise.all", "js-11-promises", "partial", "promisifying and Promise.all"),
  js("async/await syntax and error handling with try/catch", "js-12-fetch"),
  js("Fetching data with the Fetch API and handling JSON responses", "js-12-fetch", "partial", "against a simulated API"),
  js("Template literals and tagged templates", "js-13-modules", "partial", "template literals; no tagged templates"),
  js("ES modules: import/export, default vs. named exports", "js-13-modules"),
  js("Classes: constructor, methods, inheritance, static members", "js-14-classes"),
  js("Map and Set as alternatives to plain objects/arrays", "js-15-map-set"),
  js("Optional chaining and nullish coalescing", "js-15-map-set"),
  js("The prototype chain and how method lookup actually works", "js-16-prototypes"),
  js("Object.create and prototypal inheritance vs. classical inheritance", "js-16-prototypes"),
  js("Higher-order functions: functions that take or return functions", "js-17-patterns"),
  js("Currying and function composition basics", "js-17-patterns"),
  js("Common design patterns in JS: module pattern, observer pattern", "js-17-patterns"),
];

export const STUDY_LAB_LINKS: StudyLabLink[] = [...POLICY_LAB_LINKS, ...NETWORK_LAB_LINKS, ...DR_LAB_LINKS, ...ALARM_LAB_LINKS, ...COST_LAB_LINKS, ...DEPLOY_LAB_LINKS, ...CRYPTO_LAB_LINKS, ...MESSAGING_LAB_LINKS, ...AUTOSCALE_LAB_LINKS, ...SQL_LAB_LINKS, ...PYTHON_DRILL_LINKS, ...JS_LAB_LINKS];

/**
 * Unit gates that a planned engine would make playable. The gate sentence
 * is Ascendra's; the engine id names the OpsForge lab that would answer it.
 */
export const UNIT_ENGINE_GATES: StudyEngineGate[] = [
  { course: "AWSSAA", gateText: "Given an RTO and RPO, pick the disaster recovery strategy", engine: "dr-planner" },
  { course: "AWSSOA", gateText: "Given an RTO and an RPO, configure the backup and failover", engine: "dr-planner" },
  { course: "AWSSOA", gateText: "work the path -- security group, network ACL, route table", engine: "net-trace" },
  { course: "AWSANS", gateText: "find it with flow logs", engine: "net-trace" },
  { course: "AWSSOA", gateText: "Given an access denial or an audit finding, trace it to the policy", engine: "policy-eval" },
  { course: "AWSSCS", gateText: "find the policy that allowed it", engine: "policy-eval" },
  { course: "JAVASCRIPT", gateText: "predict its output and explain any hoisting or scoping surprise", engine: "js-runtime" },
  { course: "JAVASCRIPT", gateText: "the difference in `this` binding would matter", engine: "js-runtime" },
  { course: "JAVASCRIPT", gateText: "using destructuring, spread, and array methods", engine: "js-runtime" },
  { course: "JAVASCRIPT", gateText: "write it correctly with async/await including error handling", engine: "js-runtime" },
  { course: "JAVASCRIPT", gateText: "into ES modules with template literals", engine: "js-runtime" },
  { course: "JAVASCRIPT", gateText: "Explain the prototype chain for a given object", engine: "js-runtime" },
];

/**
 * Units whose lines are degree-plan bookkeeping (credit minimums, electives,
 * graduation paperwork), not something to learn. Kept for fidelity to the
 * source, collapsed in the UI, excluded from generation and readiness.
 */
export const BOOKKEEPING_UNITS: Array<{ course: string; unit: string }> = [
  { course: "CMPCBS", unit: "Communication & Information Literacy" },
  { course: "CMPCBS", unit: "Technological Solutions & Quantitative Reasoning" },
  { course: "CMPCBS", unit: "Critical Thinking" },
  { course: "CMPCBS", unit: "Civic & Global Engagement" },
  { course: "CMPCBS", unit: "Social & Scientific Inquiry" },
  { course: "CMPCBS", unit: "Christianity & Contexts" },
  { course: "CMPCBS", unit: "Free Electives" },
  { course: "CMPCBS", unit: "Graduation Requirements" },
];

export const MODALITY_LABELS: Record<StudyModality, string> = {
  "do-existing": "Do it: mission or lab",
  "do-new": "Do it: lab planned",
  read: "Read and check",
  combo: "Read, then a scenario",
  explain: "Explain it back",
};

export const MODALITY_HELP: Record<StudyModality, string> = {
  "do-existing": "An OpsForge mission or lab exercise already makes you do this. Finish it and the objective is credited.",
  "do-new": "Best learned by doing, but the lab that would let you is not built yet. Lessons teach the idea; the hands-on part is planned.",
  read: "A plain-words explanation and a check question. Reading alone never counts as mastery here.",
  combo: "An explanation plus a situation to reason through, the way the exam asks it.",
  explain: "You explain the idea in your own words and compare with a model answer.",
};
