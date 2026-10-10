/**
 * Where each Ascendra course sits on the Study home: its field, its level, and
 * the learning paths that run through it. Keyed by Ascendra track code. The
 * catalog build fails if a track has no placement or a path names a code that
 * is not in the catalog, so a refresh that adds a course has to place it here.
 * This file has no runtime imports so the catalog build script (Node) can load
 * it as well as the app.
 */

export type StudyField = "aws" | "azure" | "gcp" | "security" | "it" | "pm" | "cs" | "nursing" | "pt" | "fitness";
export type StudyLevel = "fundamentals" | "associate" | "professional" | "specialty" | "degree" | "licensure";

/** Fields in display order, with the area they are grouped under. */
export const FIELDS: Array<{ id: StudyField; title: string; area: string; blurb: string }> = [
  { id: "aws", title: "AWS", area: "Cloud", blurb: "Amazon Web Services certifications, from Cloud Practitioner to the professional and specialty exams." },
  { id: "azure", title: "Microsoft Azure", area: "Cloud", blurb: "Azure fundamentals, administrator, architect, data and specialty certifications." },
  { id: "gcp", title: "Google Cloud", area: "Cloud", blurb: "Google Cloud's leader, associate and professional certifications." },
  { id: "security", title: "Security", area: "Technology", blurb: "Security analyst, penetration testing and security architecture." },
  { id: "it", title: "IT, networking and data", area: "Technology", blurb: "Support, networking, Linux, servers, cloud operations and data." },
  { id: "cs", title: "Computer science and programming", area: "Technology", blurb: "Degree foundations and the Python and JavaScript languages." },
  { id: "pm", title: "Project management", area: "Business", blurb: "PMI and CompTIA project, program and portfolio credentials." },
  { id: "nursing", title: "Nursing", area: "Health", blurb: "Nursing assistant, practical and registered nursing, and the NCLEX exams." },
  { id: "pt", title: "Physical therapy", area: "Health", blurb: "The NPTE licensure exams, the DPT degree and ABPTS clinical specialties." },
  { id: "fitness", title: "Fitness", area: "Health", blurb: "Personal trainer and strength and conditioning certifications." },
];

export const LEVELS: Record<StudyLevel, { label: string; order: number }> = {
  fundamentals: { label: "Fundamentals", order: 0 },
  associate: { label: "Associate", order: 1 },
  degree: { label: "Degree", order: 2 },
  licensure: { label: "Licensure", order: 3 },
  professional: { label: "Professional", order: 4 },
  specialty: { label: "Specialty", order: 5 },
};

export const PLACEMENT: Record<string, { field: StudyField; level: StudyLevel }> = {
  // AWS
  AWSCLF: { field: "aws", level: "fundamentals" },
  AWSAIF: { field: "aws", level: "fundamentals" },
  AWSSAA: { field: "aws", level: "associate" },
  AWSDVA: { field: "aws", level: "associate" },
  AWSSOA: { field: "aws", level: "associate" },
  AWSDEA: { field: "aws", level: "associate" },
  AWSMLA: { field: "aws", level: "associate" },
  AWSSAP: { field: "aws", level: "professional" },
  AWSDOP: { field: "aws", level: "professional" },
  AWSSCS: { field: "aws", level: "specialty" },
  AWSANS: { field: "aws", level: "specialty" },
  // Azure ("Expert" exams sit at professional)
  AZ900: { field: "azure", level: "fundamentals" },
  AI901: { field: "azure", level: "fundamentals" },
  DP900: { field: "azure", level: "fundamentals" },
  AZ104: { field: "azure", level: "associate" },
  AZ700: { field: "azure", level: "associate" },
  DP300: { field: "azure", level: "associate" },
  AZ305: { field: "azure", level: "professional" },
  AZ400: { field: "azure", level: "professional" },
  AZ140: { field: "azure", level: "specialty" },
  AZ120: { field: "azure", level: "specialty" },
  // Google Cloud
  GCPCDL: { field: "gcp", level: "fundamentals" },
  GCPGAIL: { field: "gcp", level: "fundamentals" },
  GCPACE: { field: "gcp", level: "associate" },
  GCPPCA: { field: "gcp", level: "professional" },
  GCPPDE: { field: "gcp", level: "professional" },
  GCPDEVOPS: { field: "gcp", level: "professional" },
  GCPSEC: { field: "gcp", level: "professional" },
  GCPNET: { field: "gcp", level: "professional" },
  GCPDBE: { field: "gcp", level: "professional" },
  GCPDEV: { field: "gcp", level: "professional" },
  GCPMLE: { field: "gcp", level: "professional" },
  // Security
  SECPLUS: { field: "security", level: "associate" },
  CYSAPLUS: { field: "security", level: "professional" },
  PENTESTPLUS: { field: "security", level: "professional" },
  SECAIPLUS: { field: "security", level: "professional" },
  SECURITYX: { field: "security", level: "specialty" },
  // IT, networking and data
  TECHPLUS: { field: "it", level: "fundamentals" },
  APLUS_CORE1: { field: "it", level: "fundamentals" },
  APLUS_CORE2: { field: "it", level: "fundamentals" },
  NETWORKPLUS: { field: "it", level: "associate" },
  LINUXPLUS: { field: "it", level: "associate" },
  SERVERPLUS: { field: "it", level: "associate" },
  CLOUDPLUS: { field: "it", level: "associate" },
  DATAPLUS: { field: "it", level: "associate" },
  AUTOOPSPLUS: { field: "it", level: "associate" },
  DATAAI: { field: "it", level: "professional" },
  CLOUDNETX: { field: "it", level: "specialty" },
  // Computer science and programming
  PYTHON: { field: "cs", level: "fundamentals" },
  JAVASCRIPT: { field: "cs", level: "fundamentals" },
  CMPCBS: { field: "cs", level: "degree" },
  MSCS: { field: "cs", level: "degree" },
  // Project management
  PROJECTPLUS: { field: "pm", level: "fundamentals" },
  CAPM: { field: "pm", level: "fundamentals" },
  PMP: { field: "pm", level: "professional" },
  PMIACP: { field: "pm", level: "professional" },
  PGMP: { field: "pm", level: "professional" },
  PFMP: { field: "pm", level: "professional" },
  PMIRMP: { field: "pm", level: "specialty" },
  PMISP: { field: "pm", level: "specialty" },
  PMICP: { field: "pm", level: "specialty" },
  PMIPMOCP: { field: "pm", level: "specialty" },
  PMIPBA: { field: "pm", level: "specialty" },
  PMICPMAI: { field: "pm", level: "specialty" },
  CSPP: { field: "pm", level: "specialty" },
  // Nursing
  CNA: { field: "nursing", level: "fundamentals" },
  LPNVN: { field: "nursing", level: "degree" },
  ADNRN: { field: "nursing", level: "degree" },
  BSNRN: { field: "nursing", level: "degree" },
  NCLEXPN: { field: "nursing", level: "licensure" },
  NCLEXRN: { field: "nursing", level: "licensure" },
  // Physical therapy
  DPT: { field: "pt", level: "degree" },
  NPTEPTA: { field: "pt", level: "licensure" },
  NPTEPT: { field: "pt", level: "licensure" },
  ABPTSOCS: { field: "pt", level: "specialty" },
  ABPTSGCS: { field: "pt", level: "specialty" },
  ABPTSNCS: { field: "pt", level: "specialty" },
  ABPTSCCS: { field: "pt", level: "specialty" },
  ABPTSPCS: { field: "pt", level: "specialty" },
  ABPTSSCS: { field: "pt", level: "specialty" },
  ABPTSONC: { field: "pt", level: "specialty" },
  ABPTSECS: { field: "pt", level: "specialty" },
  ABPTSPWCS: { field: "pt", level: "specialty" },
  ABPTSWMS: { field: "pt", level: "specialty" },
  // Fitness
  NASMCPT: { field: "fitness", level: "associate" },
  ACECPT: { field: "fitness", level: "associate" },
  ACSMCPT: { field: "fitness", level: "associate" },
  NSCACPT: { field: "fitness", level: "associate" },
  NCCPTCPT: { field: "fitness", level: "associate" },
  NSCACSCS: { field: "fitness", level: "professional" },
};

/**
 * Suggested orders through a field. A course can sit on several paths; the
 * first step of each is marked "start here". The order is a suggestion for a
 * beginner, not a vendor prerequisite unless the blurb says so.
 */
export interface StudyPath {
  id: string;
  field: StudyField;
  title: string;
  blurb: string;
  steps: string[]; // Ascendra track codes, in order
}

export const PATHS: StudyPath[] = [
  { id: "aws-architect", field: "aws", title: "Solutions architect", blurb: "Design systems on AWS, from the basics to multi-account architecture.", steps: ["AWSCLF", "AWSSAA", "AWSSAP"] },
  { id: "aws-developer", field: "aws", title: "Developer to DevOps", blurb: "Build and ship applications, then automate their delivery.", steps: ["AWSCLF", "AWSDVA", "AWSDOP"] },
  { id: "aws-operations", field: "aws", title: "Cloud operations", blurb: "Run, monitor and automate workloads in production.", steps: ["AWSCLF", "AWSSOA", "AWSDOP"] },
  { id: "aws-data-ml", field: "aws", title: "Data and machine learning", blurb: "AI concepts, then data pipelines, then running ML models.", steps: ["AWSAIF", "AWSDEA", "AWSMLA"] },
  { id: "aws-security", field: "aws", title: "Security", blurb: "Architecture first, then the security specialty.", steps: ["AWSCLF", "AWSSAA", "AWSSCS"] },
  { id: "aws-networking", field: "aws", title: "Networking", blurb: "Architecture first, then the advanced networking specialty.", steps: ["AWSCLF", "AWSSAA", "AWSANS"] },
  { id: "azure-architect", field: "azure", title: "Administrator to architect", blurb: "Run Azure day to day, then design solutions on it.", steps: ["AZ900", "AZ104", "AZ305"] },
  { id: "azure-devops", field: "azure", title: "DevOps engineer", blurb: "Administration first, then delivery pipelines and platform automation.", steps: ["AZ900", "AZ104", "AZ400"] },
  { id: "azure-network", field: "azure", title: "Network engineer", blurb: "Administration first, then hybrid and virtual networking.", steps: ["AZ900", "AZ104", "AZ700"] },
  { id: "azure-data", field: "azure", title: "Data", blurb: "Data concepts, then running relational databases on Azure.", steps: ["DP900", "DP300"] },
  { id: "gcp-architect", field: "gcp", title: "Cloud architect", blurb: "Business view, hands-on engineering, then architecture.", steps: ["GCPCDL", "GCPACE", "GCPPCA"] },
  { id: "gcp-devops", field: "gcp", title: "DevOps and reliability", blurb: "Engineer the platform, then run it with SRE practices.", steps: ["GCPACE", "GCPDEVOPS"] },
  { id: "gcp-data-ml", field: "gcp", title: "Data and machine learning", blurb: "Generative AI concepts, data engineering, then ML engineering.", steps: ["GCPGAIL", "GCPPDE", "GCPMLE"] },
  { id: "gcp-security-network", field: "gcp", title: "Security and networking", blurb: "Engineer the platform, then secure and connect it.", steps: ["GCPACE", "GCPNET", "GCPSEC"] },
  { id: "comptia-security", field: "security", title: "Security career", blurb: "The CompTIA security ladder: foundations, analyst, tester, architect.", steps: ["SECPLUS", "CYSAPLUS", "PENTESTPLUS", "SECURITYX"] },
  { id: "it-support", field: "it", title: "IT support", blurb: "The classic entry route: tech basics, A+, then networking.", steps: ["TECHPLUS", "APLUS_CORE1", "APLUS_CORE2", "NETWORKPLUS"] },
  { id: "it-infrastructure", field: "it", title: "Infrastructure", blurb: "Networks, Linux and servers, then cloud operations and design.", steps: ["NETWORKPLUS", "LINUXPLUS", "SERVERPLUS", "CLOUDPLUS", "CLOUDNETX"] },
  { id: "it-data", field: "it", title: "Data", blurb: "Analysis and reporting, then data science and AI.", steps: ["DATAPLUS", "DATAAI"] },
  { id: "cs-programming", field: "cs", title: "Programming to computer science", blurb: "Learn a language, then the degree-level foundations.", steps: ["PYTHON", "JAVASCRIPT", "MSCS"] },
  { id: "pm-core", field: "pm", title: "Project to portfolio", blurb: "Entry certificate, the PMP, then program and portfolio management.", steps: ["CAPM", "PMP", "PGMP", "PFMP"] },
  { id: "nursing-rn", field: "nursing", title: "Registered nurse", blurb: "Nursing assistant, an RN degree, then the NCLEX-RN.", steps: ["CNA", "ADNRN", "NCLEXRN"] },
  { id: "nursing-pn", field: "nursing", title: "Practical nurse", blurb: "Nursing assistant, practical nursing, then the NCLEX-PN.", steps: ["CNA", "LPNVN", "NCLEXPN"] },
  { id: "pt-clinician", field: "pt", title: "Physical therapist", blurb: "The DPT degree, then the NPTE licensure exam.", steps: ["DPT", "NPTEPT"] },
  { id: "fitness-coach", field: "fitness", title: "Trainer to strength coach", blurb: "A personal trainer certificate, then strength and conditioning.", steps: ["NASMCPT", "NSCACSCS"] },
];
