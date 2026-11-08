/**
 * Deterministic SYNTHETIC simulator of the field app's offline store and synchronisation (issue #62 preparation).
 * It is a test double and a specification: `SyncAdapter` is the interface the real field app must expose to run the SAME scenarios
 * (scenarios.ts) in its own tests. It simulates no real device, browser, storage engine or network; real-device behaviour is
 * measured with tools/offline-probe. The rules mirror docs/architecture/offline-sync.md: success only after a durable write,
 * idempotent operation ids, receipts, no last-write-wins on conflicts, tombstones, record receipt separate from attachment completion.
 */
export type Network = "online" | "offline";
export type SyncStatus = "editing" | "locally_saved" | "queued" | "server_received" | "needs_attention" | "withdrawn";
export type ServerMode = "ok" | "timeout" | "reject" | "lose_response_after_commit";

export interface Interview { id: string; revision: number; payload: string; withdrawn?: boolean }
export interface SyncAdapter {
  /** Saves (or revises) a draft. Resolves ok only after the durable write is acknowledged. */
  save(i: Interview): Promise<{ ok: true } | { ok: false; reason: "storage_full" | "locked" }>;
  setNetwork(n: Network): void;
  setServer(mode: ServerMode): void;
  expireSession(): void;
  reauthenticate(): void;
  /** Runs one synchronisation pass over the queue. */
  sync(): Promise<void>;
  /** Simulates the app being killed and reopened: volatile state is lost, durable state is recovered. */
  restart(): void;
  withdraw(id: string): void;
  fillStorage(): void;
  attachMedia(interviewId: string, bytes: number): void;
  status(id: string): SyncStatus | "unknown";
  attachmentProgress(id: string): { sent: number; total: number } | null;
  /** What the server has stored (for assertions). */
  server: { records(): { id: string; revision: number; payload: string }[]; tombstones(): string[]; conflicts(): { id: string; revisions: number[] }[]; receiptsFor(id: string): number };
  /** Number of queued, unacknowledged operations the device still holds. */
  pending(): number;
  locked(): boolean;
}

interface Op { opId: string; interview: Interview; attempts: number; reason?: string }

class SimServer {
  private recs = new Map<string, Map<number, { payload: string; hash: string }>>();
  private ops = new Map<string, { hash: string; receipt: number }>();
  private tomb = new Set<string>();
  private nextReceipt = 1;
  private receipts = new Map<string, number>();
  mode: ServerMode = "ok";
  records() { return [...this.recs.entries()].map(([id, m]) => { const rev = Math.max(...m.keys()); return { id, revision: rev, payload: m.get(rev)!.payload }; }); }
  tombstones() { return [...this.tomb]; }
  conflicts() { return [...this.conflictIds].map((id) => ({ id, revisions: [...(this.recs.get(id)?.keys() ?? [])].sort((x, y) => x - y) })); }
  private conflictIds = new Set<string>();
  receiptsFor(id: string) { return this.receipts.get(id) ?? 0; }
  withdraw(id: string) { this.tomb.add(id); this.recs.delete(id); }
  /** Returns a receipt, "timeout" (no answer), "rejected", "gone" (tombstoned) or "lost" (committed but the answer is lost). */
  receive(op: Op): number | "timeout" | "rejected" | "gone" | "lost" | "conflict" {
    if (this.mode === "timeout") return "timeout";
    if (this.tomb.has(op.interview.id)) return "gone";
    if (this.mode === "reject") return "rejected";
    const hash = op.interview.payload;
    const seen = this.ops.get(op.opId);
    if (seen) return seen.hash === hash ? seen.receipt : "rejected";          // same key, changed payload: 409
    const m = this.recs.get(op.interview.id) ?? new Map();
    const existing = m.get(op.interview.revision);
    if (existing && existing.hash !== hash) { this.conflictIds.add(op.interview.id); m.set(op.interview.revision + 1000, { payload: hash, hash }); this.recs.set(op.interview.id, m); return "conflict"; }
    m.set(op.interview.revision, { payload: op.interview.payload, hash });
    this.recs.set(op.interview.id, m);
    const receipt = this.nextReceipt++;
    this.ops.set(op.opId, { hash, receipt });
    this.receipts.set(op.interview.id, (this.receipts.get(op.interview.id) ?? 0) + 1);
    return this.mode === "lose_response_after_commit" ? "lost" : receipt;
  }
}

export const QUOTA = 5;           // synthetic: five records
export const MAX_ATTEMPTS = 4;

/** The reference implementation of `SyncAdapter`. */
export class SimulatedDevice implements SyncAdapter {
  private srv = new SimServer();
  private net: Network = "online";
  private sessionOk = true;
  private durable = new Map<string, { i: Interview; status: SyncStatus }>();       // survives restart
  private queue: Op[] = [];                                                          // durable too
  private media = new Map<string, { sent: number; total: number }>();
  private storageFull = false;
  private opSeq = 0;
  private volatileLocked = false;                                                    // lost on restart
  readonly server = { records: () => this.srv.records(), tombstones: () => this.srv.tombstones(), conflicts: () => this.srv.conflicts(), receiptsFor: (id: string) => this.srv.receiptsFor(id) };

  async save(i: Interview) {
    if (!this.sessionOk) return { ok: false as const, reason: "locked" as const };
    if (this.storageFull || (!this.durable.has(i.id) && this.durable.size >= QUOTA)) return { ok: false as const, reason: "storage_full" as const };
    const prev = this.durable.get(i.id);
    this.durable.set(i.id, { i: { ...i }, status: "locally_saved" });                // the write is acknowledged here
    this.queue = this.queue.filter((o) => o.interview.id !== i.id || o.interview.revision !== i.revision);
    this.queue.push({ opId: `op-${i.id}-${i.revision}-${++this.opSeq}`, interview: { ...i }, attempts: 0 });
    this.durable.get(i.id)!.status = "queued";
    void prev;
    return { ok: true as const };
  }
  setNetwork(n: Network) { this.net = n; }
  setServer(m: ServerMode) { this.srv.mode = m; }
  expireSession() { this.sessionOk = false; this.volatileLocked = true; }
  reauthenticate() { this.sessionOk = true; this.volatileLocked = false; }
  locked() { return this.volatileLocked || !this.sessionOk; }
  fillStorage() { this.storageFull = true; }
  withdraw(id: string) {
    const d = this.durable.get(id);
    if (d) { d.status = "withdrawn"; d.i = { ...d.i, withdrawn: true }; }
    this.queue = this.queue.filter((o) => o.interview.id !== id);                     // a withdrawn record is never uploaded
    this.srv.withdraw(id);                                                            // modelled as the withdrawal reaching the server tombstone list
  }
  attachMedia(id: string, bytes: number) { this.media.set(id, { sent: 0, total: bytes }); }
  attachmentProgress(id: string) { return this.media.get(id) ?? null; }
  pending() { return this.queue.length; }
  status(id: string) { return this.durable.get(id)?.status ?? "unknown"; }
  restart() { this.volatileLocked = true; this.net = "online"; }                      // queue and drafts are durable; the session must be re-established

  async sync() {
    if (this.net === "offline" || !this.sessionOk) return;
    for (const op of [...this.queue]) {
      const d = this.durable.get(op.interview.id);
      if (!d || d.status === "withdrawn") { this.queue = this.queue.filter((o) => o !== op); continue; }
      const r = this.srv.receive(op);
      if (typeof r === "number") { this.queue = this.queue.filter((o) => o !== op); d.status = "server_received"; continue; }
      op.attempts++;
      if (r === "gone") { this.queue = this.queue.filter((o) => o !== op); d.status = "withdrawn"; continue; }
      if (r === "conflict") { d.status = "needs_attention"; op.reason = "conflict"; this.queue = this.queue.filter((o) => o !== op); continue; }
      if (r === "rejected") { d.status = "needs_attention"; op.reason = "rejected"; continue; }          // retained, visible, not dropped
      if (op.attempts >= MAX_ATTEMPTS) d.status = "needs_attention";                                       // timeout/lost: cap retries, keep the record
    }
    // media resumes from where it stopped and never affects the interview record's receipt
    for (const [id, m] of this.media) if (this.net === "online" && this.sessionOk && this.durable.get(id)?.status !== "withdrawn") m.sent = Math.min(m.total, m.sent + Math.ceil(m.total / 2));
  }
}
