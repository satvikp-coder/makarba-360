/**
 * Candidate location review (#101). A researcher-proposed place stays private until a reviewer has recorded four
 * separate checks (source, name, access, boundary) and a different person approves it. A rejected or out-of-boundary
 * candidate is never publicly visible. Approval of the shape is NOT approval of any content (see index.ts).
 */
export type Position = [number, number];
export type Ring = Position[];
export interface CandidateGeometry { type: "Point" | "Polygon"; coordinates: Position | Ring[] }

export type CandidateState = "candidate" | "in_review" | "changes_requested" | "approved" | "rejected" | "published";
export type CheckState = "unchecked" | "passed" | "failed";
export interface Check { state: CheckState; evidence: string | null; by: string | null }

export interface Candidate {
  id: string; revision: number; state: CandidateState;
  proposedBy: string; name: string; category: string;
  geometry: CandidateGeometry;
  checks: { source: Check; name: Check; access: Check; boundary: Check };
  decidedBy: string | null; decisionReason: string | null;
  /** Revision of the geometry the checks were made against; any geometry edit invalidates them. */
  checkedRevision: number | null;
}

const unchecked = (): Check => ({ state: "unchecked", evidence: null, by: null });
export function propose(id: string, proposedBy: string, name: string, category: string, geometry: CandidateGeometry): Candidate {
  return { id, revision: 1, state: "candidate", proposedBy, name, category, geometry, checks: { source: unchecked(), name: unchecked(), access: unchecked(), boundary: unchecked() }, decidedBy: null, decisionReason: null, checkedRevision: null };
}

/** Ray-casting test; boundary points count as inside. */
export function pointInRing(p: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    const onSeg = (p[1] - yi) * (xj - xi) === (p[0] - xi) * (yj - yi) && Math.min(xi, xj) <= p[0] && p[0] <= Math.max(xi, xj) && Math.min(yi, yj) <= p[1] && p[1] <= Math.max(yi, yj);
    if (onSeg) return true;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Every vertex of the candidate must lie inside the study boundary. The caller supplies the boundary; none is assumed. */
export function insideBoundary(g: CandidateGeometry, boundary: Ring): { inside: boolean; outsideVertices: number } {
  const pts: Position[] = g.type === "Point" ? [g.coordinates as Position] : (g.coordinates as Ring[]).flat();
  const outside = pts.filter((p) => !pointInRing(p, boundary)).length;
  return { inside: outside === 0, outsideVertices: outside };
}

export function recordCheck(c: Candidate, name: keyof Candidate["checks"], state: "passed" | "failed", evidence: string, by: string, boundary?: Ring): Candidate | { error: string } {
  if (c.state === "approved" || c.state === "rejected" || c.state === "published") return { error: `cannot change checks on a ${c.state} candidate` };
  if (!evidence.trim()) return { error: "evidence is required for every check" };
  if (name === "boundary") {
    if (!boundary) return { error: "a study boundary is required for the boundary check" };
    const r = insideBoundary(c.geometry, boundary);
    // the boundary check is computed, not asserted: a reviewer cannot pass a geometry that lies outside
    if (state === "passed" && !r.inside) return { error: `${r.outsideVertices} vertex(es) lie outside the study boundary; the check cannot pass` };
  }
  return { ...c, state: "in_review", checkedRevision: c.revision, checks: { ...c.checks, [name]: { state, evidence: evidence.trim(), by } } };
}

/** Editing geometry (or name) creates a new revision and clears every check. */
export function editCandidate(c: Candidate, patch: { name?: string; category?: string; geometry?: CandidateGeometry }): Candidate | { error: string } {
  if (c.state === "approved" || c.state === "rejected" || c.state === "published") return { error: `cannot edit a ${c.state} candidate` };
  const fresh = propose(c.id, c.proposedBy, patch.name ?? c.name, patch.category ?? c.category, patch.geometry ?? c.geometry);
  return { ...fresh, revision: c.revision + 1, state: "candidate" };
}

export function approvalBlockers(c: Candidate, approver: string): string[] {
  const why: string[] = [];
  if (approver === c.proposedBy) why.push("approver must differ from the proposer");
  if (c.state !== "in_review") why.push(`state is "${c.state}"; checks have not been recorded`);
  for (const [k, v] of Object.entries(c.checks)) {
    if (v.state === "unchecked") why.push(`${k} check not done`);
    else if (v.state === "failed") why.push(`${k} check failed`);
    else if (v.by === approver) why.push(`${k} check was made by the approver; another reviewer is needed`);
  }
  if (c.checkedRevision !== c.revision) why.push("checks were made on an earlier revision");
  return why;
}

export function approve(c: Candidate, approver: string): Candidate | { blocked: string[] } {
  const b = approvalBlockers(c, approver);
  return b.length ? { blocked: b } : { ...c, state: "approved", decidedBy: approver, decisionReason: null };
}
export function reject(c: Candidate, by: string, reason: string): Candidate | { error: string } {
  if (!reason.trim()) return { error: "a reason is required" };
  if (c.state === "published") return { error: "a published place is withdrawn, not rejected" };
  return { ...c, state: "rejected", decidedBy: by, decisionReason: reason.trim() };
}
export function requestChanges(c: Candidate, by: string, reason: string): Candidate | { error: string } {
  if (!reason.trim()) return { error: "a reason is required" };
  return c.state === "approved" || c.state === "rejected" || c.state === "published" ? { error: `cannot request changes on a ${c.state} candidate` } : { ...c, state: "changes_requested", decidedBy: by, decisionReason: reason.trim() };
}

/** Public view: only an approved-and-published candidate, with name, category and geometry. Everything else is null (private). */
export function publicView(c: Candidate, boundary: Ring) {
  if (c.state !== "published") return null;
  if (!insideBoundary(c.geometry, boundary).inside) return null;       // re-checked at the edge: out-of-boundary never leaks
  return { id: c.id, name: c.name, category: c.category, geometry: c.geometry };
}
export function publish(c: Candidate, by: string): Candidate | { error: string } {
  return c.state === "approved" ? { ...c, state: "published", decidedBy: by } : { error: `only an approved candidate can be published (state is "${c.state}")` };
}

/** What the reviewer sees when geometry changed between revisions: counts only, never a silent overwrite. */
export function geometryDiff(a: CandidateGeometry, b: CandidateGeometry): { typeChanged: boolean; vertexDelta: number; moved: boolean } {
  const pts = (g: CandidateGeometry): Position[] => (g.type === "Point" ? [g.coordinates as Position] : (g.coordinates as Ring[]).flat());
  const pa = pts(a), pb = pts(b);
  const same = pa.length === pb.length && pa.every((p, i) => p[0] === pb[i]![0] && p[1] === pb[i]![1]);
  return { typeChanged: a.type !== b.type, vertexDelta: pb.length - pa.length, moved: !same };
}
