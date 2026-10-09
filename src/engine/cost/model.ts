/**
 * Cost model for the fictional platform, in credits per month. Every price
 * here is invented and stated in the lab, so the lessons are about shape,
 * not about any vendor's price list: committed capacity is cheaper per unit
 * but paid while idle; interruptible capacity is cheapest but only for work
 * that can stop and restart; colder storage tiers charge for retrieval and
 * take longer; data transfer costs depend on the path; a cache in front of
 * egress and a private endpoint instead of a translator move whole line
 * items. The planner enumerates every plan to name the cheapest one that
 * meets a requirement, so over-spending fails as surely as falling short.
 */
export interface CostWorkload {
  name: string;
  /** Compute demand in capacity units during quiet hours and at peak, and how many hours a day the peak lasts. */
  baselineUnits: number;
  peakUnits: number;
  peakHoursPerDay: number;
  /** Batch work in unit-hours per month, and whether it tolerates interruption. */
  batchUnitHours: number;
  batchInterruptible: boolean;
  /** Storage in GB: hot data read constantly; cold data read rarely (GB retrieved per month) with a required retrieval speed. */
  hotGb: number;
  coldGb: number;
  coldRetrievedGb: number;
  coldRetrievalNeed: "minutes" | "hours";
  /** Monthly transfer in GB: to the internet (share a cache could serve), to platform services, across zones. */
  egressGb: number;
  cacheableShare: number;
  serviceGb: number;
  zones: number;
}

export type ColdTier = "hot" | "cool" | "archive";

export interface CostPlan {
  /** Capacity units bought on a one-year commitment; paid whether used or not. */
  commitUnits: number;
  /** Instance size relative to what the demand needs: 1 is right-sized, 2 is twice as large (utilisation halves), 0.5 is too small. */
  sizeFactor: 0.5 | 1 | 2;
  batchModel: "on-demand" | "interruptible";
  coldTier: ColdTier;
  /** Platform-service traffic through a private endpoint (fixed fee per zone, cheap per GB) instead of the address translator (per GB). */
  privateEndpoint: boolean;
  /** One address translator per zone (fixed fee each, no cross-zone hop) or one shared (cross-zone traffic for the other zones). */
  natPerZone: boolean;
  /** A cache at the edge serving the cacheable share of egress. */
  cdn: boolean;
  /** A spend alarm on the monthly bill. */
  budgetAlarm: boolean;
  /** Every resource tagged with team and environment so the bill can be allocated. */
  tagsFull: boolean;
}

export const PRICES = {
  onDemandUnitMonth: 100,
  committedUnitMonth: 60,
  onDemandUnitHour: 100 / 730,
  interruptibleUnitHour: 0.04,
  storage: { hot: 0.25, cool: 0.12, archive: 0.04 } as Record<ColdTier, number>,
  retrieval: { hot: 0, cool: 0.1, archive: 0.3 } as Record<ColdTier, number>,
  retrievalSpeed: { hot: "minutes", cool: "minutes", archive: "hours" } as Record<ColdTier, "minutes" | "hours">,
  egressGb: 0.09,
  cdnGb: 0.05,
  cdnFixed: 20,
  natFixed: 32,
  natGb: 0.045,
  crossZoneGb: 0.01,
  endpointFixedPerZone: 7,
  endpointGb: 0.01,
} as const;

export interface CostLine {
  item: string;
  credits: number;
  why: string;
}

export interface CostDerived {
  total: number;
  lines: CostLine[];
  /** Average utilisation of the compute actually paid for (committed + on-demand), 0-1. */
  utilisation: number;
  /** Committed unit-months that sat idle. */
  idleCommitted: number;
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

export function deriveCost(w: CostWorkload, p: CostPlan): CostDerived {
  const lines: CostLine[] = [];
  // Compute: demand in units × size factor, split into quiet and peak hours.
  const quietShare = (24 - w.peakHoursPerDay) / 24;
  const peakShare = w.peakHoursPerDay / 24;
  const quietNeed = w.baselineUnits * p.sizeFactor;
  const peakNeed = w.peakUnits * p.sizeFactor;
  const committed = p.commitUnits * PRICES.committedUnitMonth;
  const onDemandUnitMonths = Math.max(0, quietNeed - p.commitUnits) * quietShare + Math.max(0, peakNeed - p.commitUnits) * peakShare;
  const onDemand = onDemandUnitMonths * PRICES.onDemandUnitMonth;
  const idleCommitted = Math.max(0, p.commitUnits - quietNeed) * quietShare + Math.max(0, p.commitUnits - peakNeed) * peakShare;
  const paidUnitMonths = p.commitUnits + onDemandUnitMonths;
  const demandUnitMonths = w.baselineUnits * quietShare + w.peakUnits * peakShare;
  const utilisation = paidUnitMonths > 0 ? Math.min(1, demandUnitMonths / paidUnitMonths) : 0;
  lines.push({ item: `Committed compute (${p.commitUnits} units)`, credits: r(committed), why: `${p.commitUnits} units × ${PRICES.committedUnitMonth} credits, paid all month${idleCommitted > 0.01 ? `; about ${r(idleCommitted)} unit-months of it sit idle` : ""}` });
  lines.push({ item: "On-demand compute", credits: r(onDemand), why: `${r(onDemandUnitMonths)} unit-months above the commitment × ${PRICES.onDemandUnitMonth} credits${p.sizeFactor !== 1 ? ` (instances ${p.sizeFactor}× the needed size)` : ""}` });
  // Batch.
  const batchRate = p.batchModel === "interruptible" ? PRICES.interruptibleUnitHour : PRICES.onDemandUnitHour;
  lines.push({ item: `Batch compute (${p.batchModel})`, credits: r(w.batchUnitHours * batchRate), why: `${w.batchUnitHours} unit-hours × ${r(batchRate)} credits` });
  // Storage.
  lines.push({ item: "Hot storage", credits: r(w.hotGb * PRICES.storage.hot), why: `${w.hotGb} GB × ${PRICES.storage.hot}` });
  const coldStore = w.coldGb * PRICES.storage[p.coldTier];
  const coldRetrieve = w.coldRetrievedGb * PRICES.retrieval[p.coldTier];
  lines.push({ item: `Cold storage (${p.coldTier} tier)`, credits: r(coldStore + coldRetrieve), why: `${w.coldGb} GB × ${PRICES.storage[p.coldTier]}${coldRetrieve ? ` plus ${w.coldRetrievedGb} GB retrieved × ${PRICES.retrieval[p.coldTier]}` : ""}` });
  // Egress and cache.
  const cached = p.cdn ? w.egressGb * w.cacheableShare : 0;
  const origin = w.egressGb - cached;
  lines.push({ item: "Internet egress from origin", credits: r(origin * PRICES.egressGb), why: `${r(origin)} GB × ${PRICES.egressGb}` });
  if (p.cdn) lines.push({ item: "Edge cache", credits: r(PRICES.cdnFixed + cached * PRICES.cdnGb), why: `${PRICES.cdnFixed} fixed plus ${r(cached)} GB served from the edge × ${PRICES.cdnGb}` });
  // Service traffic: endpoint or translator.
  let natGb = origin; // egress leaves through the translator from private hosts
  if (p.privateEndpoint) lines.push({ item: "Private endpoint", credits: r(w.zones * PRICES.endpointFixedPerZone + w.serviceGb * PRICES.endpointGb), why: `${w.zones} zones × ${PRICES.endpointFixedPerZone} plus ${w.serviceGb} GB × ${PRICES.endpointGb}` });
  else natGb += w.serviceGb;
  const natCount = p.natPerZone ? w.zones : 1;
  const crossZone = p.natPerZone ? 0 : natGb * ((w.zones - 1) / w.zones) * PRICES.crossZoneGb;
  lines.push({ item: `Address translator (${natCount})`, credits: r(natCount * PRICES.natFixed + natGb * PRICES.natGb + crossZone), why: `${natCount} × ${PRICES.natFixed} fixed plus ${r(natGb)} GB × ${PRICES.natGb}${crossZone ? ` plus cross-zone hops ${r(crossZone)}` : ""}` });
  const total = r(lines.reduce((a, l) => a + l.credits, 0));
  return { total, lines, utilisation, idleCommitted };
}

export interface CostRequirement {
  targetCredits: number;
  /** Compute must serve the peak (size factor at least 1). */
  requireTags?: boolean;
  requireBudgetAlarm?: boolean;
}

export interface CostCheck {
  id: "capacity" | "batch" | "retrieval" | "alarm" | "tags" | "target" | "lean";
  label: string;
  passed: boolean;
  detail: string;
}

export const LEAN_TOLERANCE = 1.1;

export function feasible(w: CostWorkload, p: CostPlan, req: CostRequirement): boolean {
  if (p.sizeFactor < 1) return false;
  if (p.batchModel === "interruptible" && !w.batchInterruptible) return false;
  if (w.coldRetrievalNeed === "minutes" && PRICES.retrievalSpeed[p.coldTier] === "hours") return false;
  if (req.requireBudgetAlarm && !p.budgetAlarm) return false;
  if (req.requireTags && !p.tagsFull) return false;
  return true;
}

export function cheapestFeasible(w: CostWorkload, req: CostRequirement): { plan: CostPlan; derived: CostDerived } | undefined {
  let best: { plan: CostPlan; derived: CostDerived } | undefined;
  const maxCommit = Math.ceil(w.peakUnits * 2);
  for (let commit = 0; commit <= maxCommit; commit++)
    for (const sizeFactor of [1, 2] as const)
      for (const batchModel of ["on-demand", "interruptible"] as const)
        for (const coldTier of ["hot", "cool", "archive"] as const)
          for (const privateEndpoint of [false, true])
            for (const natPerZone of [false, true])
              for (const cdn of [false, true]) {
                const plan: CostPlan = { commitUnits: commit, sizeFactor, batchModel, coldTier, privateEndpoint, natPerZone, cdn, budgetAlarm: true, tagsFull: true };
                if (!feasible(w, plan, req)) continue;
                const derived = deriveCost(w, plan);
                if (!best || derived.total < best.derived.total) best = { plan, derived };
              }
  return best;
}

export function checkCost(w: CostWorkload, req: CostRequirement, p: CostPlan): { derived: CostDerived; checks: CostCheck[]; cheapest?: { plan: CostPlan; derived: CostDerived } } {
  const derived = deriveCost(w, p);
  const cheapest = cheapestFeasible(w, req);
  const checks: CostCheck[] = [
    { id: "capacity", label: "Serves the peak", passed: p.sizeFactor >= 1, detail: p.sizeFactor >= 1 ? `instances ${p.sizeFactor}× the needed size; utilisation about ${Math.round(derived.utilisation * 100)}%` : "instances half the needed size: the peak overloads them" },
    { id: "batch", label: "Batch work fits its compute model", passed: !(p.batchModel === "interruptible" && !w.batchInterruptible), detail: p.batchModel === "interruptible" ? (w.batchInterruptible ? "the job checkpoints and resumes, so interruptible capacity is fine" : "the job cannot be interrupted; interruptible capacity would lose it") : "on-demand capacity: never interrupted, full price" },
    { id: "retrieval", label: `Cold data comes back in ${w.coldRetrievalNeed}`, passed: !(w.coldRetrievalNeed === "minutes" && PRICES.retrievalSpeed[p.coldTier] === "hours"), detail: `${p.coldTier} tier returns data in ${PRICES.retrievalSpeed[p.coldTier]}` },
    { id: "alarm", label: "A spend alarm exists", passed: !req.requireBudgetAlarm || p.budgetAlarm, detail: p.budgetAlarm ? "the bill is watched" : "nobody finds out about a surprise until the invoice" },
    { id: "tags", label: "Resources are tagged for allocation", passed: !req.requireTags || p.tagsFull, detail: p.tagsFull ? "every line can be attributed to a team and environment" : "an unattributed bill cannot be reduced by anyone in particular" },
    { id: "target", label: `Within ${req.targetCredits} credits a month`, passed: derived.total <= req.targetCredits, detail: `this plan costs ${derived.total} credits a month` },
    { id: "lean", label: "No more than needed", passed: cheapest ? derived.total <= cheapest.derived.total * LEAN_TOLERANCE : true, detail: cheapest ? `the cheapest plan that meets the requirement costs ${cheapest.derived.total} credits (${describeCostPlan(cheapest.plan)})` : "no plan meets the requirement" },
  ];
  return { derived, checks, cheapest };
}

export function describeCostPlan(p: CostPlan): string {
  return [`${p.commitUnits} committed units`, `${p.sizeFactor}× size`, `${p.batchModel} batch`, `${p.coldTier} cold tier`, p.privateEndpoint ? "private endpoint" : "translator for service traffic", p.natPerZone ? "translator per zone" : "one shared translator", p.cdn ? "edge cache" : "no cache"].join(", ");
}
