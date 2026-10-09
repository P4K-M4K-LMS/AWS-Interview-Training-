import { Link } from "react-router-dom";
import { missionsForTrack } from "../content/missions";
import { TRACK_BY_ID } from "../content/curriculum";
import { useMissionStatuses } from "../data/hooks";
import { Callout, PageHeader, Panel, StatusBadge } from "../components/ui";

export function SecurityOpsPage() {
  const { statuses, skills } = useMissionStatuses();
  const track = TRACK_BY_ID.get("netsec")!;
  const missions = missionsForTrack("netsec");
  return (
    <div className="space-y-4">
      <PageHeader title="Security" subtitle="Defensive investigations on isolated, fictional systems. Nothing here touches real networks." />
      <Callout kind="warn" title="Not a certification">
        These labs introduce foundations related to CND/GSEC topics (logging, least privilege, hardening, incident response). They do not claim equivalence with, or endorsement by, any certification body.
      </Callout>
      <Panel title="Investigations">
        <ul className="space-y-2 text-sm">
          {missions.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <div>
                <Link to={`/missions/${m.id}`} className="font-medium hover:underline">
                  {m.title}
                </Link>
                <div className="muted text-xs">{m.summary}</div>
              </div>
              <StatusBadge status={statuses.get(m.id) ?? "locked"} />
            </li>
          ))}
          <li className="muted text-xs">Planned: firewall triage, suspicious cron job, web log anomaly hunt, hardening checklist (see STATUS.md).</li>
        </ul>
      </Panel>
      <Panel title="Skills in this track">
        <ul className="grid sm:grid-cols-2 gap-1 text-sm">
          {track.skills.map((s) => (
            <li key={s.id} className="flex justify-between">
              <span>{s.name}</span>
              <span className="muted text-xs">{skills.get(s.id)?.mastery ?? 0}%</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
