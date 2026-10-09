import type { Mission, TrackId } from "../../domain/types";
import { linuxMissions } from "./linux";
import { pythonMissions } from "./python";
import { bigoMissions } from "./bigo";
import { netsecMissions } from "./netsec";
import { devopsMissions } from "./devops";
import { incidentMissions } from "./incidents";
import { cicdMissions } from "./cicd";
import { goMissions } from "./go";

export const MISSIONS: Mission[] = [...linuxMissions, ...pythonMissions, ...bigoMissions, ...netsecMissions, ...devopsMissions, ...cicdMissions, ...incidentMissions, ...goMissions];
export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

export function missionsForTrack(trackId: TrackId): Mission[] {
  return MISSIONS.filter((m) => m.trackId === trackId);
}

/** Recommended order for a beginner: the first incomplete mission whose prerequisites are done. */
export const RECOMMENDED_ORDER: string[] = [
  "linux-01-find-your-way",
  "python-01-uptime-report",
  "linux-02-log-detective",
  "bigo-01-growth",
  "python-02-log-parser",
  "linux-03-locked-out",
  "netsec-01-brute-force",
  "python-03-config-validator",
  "bigo-02-search-sort",
  "devops-01-broken-pipeline",
  "devops-02-green-locally-red-in-ci",
  "devops-03-bad-release-rollback",
  "devops-04-secret-wiring",
  "incident-01-cache-stampede",
  "incident-02-traffic-surge",
  "incident-03-dead-consumers",
  "incident-04-replica-lag",
  "go-01-config-parser",
  "go-02-worker-pool",
  "go-03-timeouts-context",
  "go-04-retries-idempotency",
];
