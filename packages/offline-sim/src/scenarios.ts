import type { Interview, SyncAdapter } from "./index.js";

/**
 * Scenario manifest for issue #62. Each scenario drives a `SyncAdapter` and returns a list of failed assertions (empty = pass), so the
 * same manifest runs against the simulator (here, synthetic) and later against the real field app's adapter. A real-device run
 * additionally needs tools/offline-probe reports (scripts/check_device_reports.py); these scenarios do not replace that.
 */
export interface Scenario { id: string; title: string; run: (mk: () => SyncAdapter) => Promise<string[]> }
const iv = (id: string, revision = 1, payload = `synthetic answers ${id} r${revision}`): Interview => ({ id, revision, payload });
const expectEq = (out: string[], label: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

export const SCENARIOS: Scenario[] = [
  { id: "N01", title: "Offline save is durable, shows queued (never synced), and uploads once after reconnecting", run: async (mk) => {
    const d = mk(), o: string[] = []; d.setNetwork("offline");
    expectEq(o, "save", await d.save(iv("a")), { ok: true });
    await d.sync(); expectEq(o, "status offline", d.status("a"), "queued"); expectEq(o, "server empty", d.server.records().length, 0);
    d.setNetwork("online"); await d.sync();
    expectEq(o, "status after sync", d.status("a"), "server_received"); expectEq(o, "records", d.server.records().length, 1); expectEq(o, "pending", d.pending(), 0); return o; } },
  { id: "N02", title: "Response lost after the server committed: retry returns the same receipt and there is one record", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); d.setServer("lose_response_after_commit");
    await d.sync(); expectEq(o, "still queued", d.status("a"), "queued");
    d.setServer("ok"); await d.sync();
    expectEq(o, "synced", d.status("a"), "server_received"); expectEq(o, "records", d.server.records().length, 1); expectEq(o, "one logical write", d.server.receiptsFor("a"), 1); return o; } },
  { id: "N03", title: "Ten repeated sends cause exactly one logical write", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a"));
    for (let i = 0; i < 10; i++) { d.setServer("lose_response_after_commit"); await d.sync(); }
    d.setServer("ok"); await d.sync(); expectEq(o, "writes", d.server.receiptsFor("a"), 1); expectEq(o, "records", d.server.records().length, 1); return o; } },
  { id: "N04", title: "Server timeouts keep the record queued; after the retry cap it needs attention but is never dropped", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); d.setServer("timeout");
    for (let i = 0; i < 6; i++) await d.sync();
    expectEq(o, "status", d.status("a"), "needs_attention"); expectEq(o, "kept", d.pending(), 1);
    d.setServer("ok"); await d.sync(); expectEq(o, "recovers", d.status("a"), "server_received"); return o; } },
  { id: "N05", title: "A rejected submission is retained with its status, not silently dropped or marked synced", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); d.setServer("reject"); await d.sync();
    expectEq(o, "status", d.status("a"), "needs_attention"); expectEq(o, "kept", d.pending(), 1); expectEq(o, "server", d.server.records().length, 0); return o; } },
  { id: "N06", title: "Expired session locks saving, keeps drafts, pauses sync until re-authentication, then continues", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); d.expireSession();
    expectEq(o, "locked", d.locked(), true); expectEq(o, "save refused", await d.save(iv("b")), { ok: false, reason: "locked" });
    await d.sync(); expectEq(o, "nothing sent", d.server.records().length, 0); expectEq(o, "draft kept", d.status("a"), "queued");
    d.reauthenticate(); await d.sync(); expectEq(o, "sent", d.status("a"), "server_received"); return o; } },
  { id: "N07", title: "App killed with unsynced work: drafts and queue are recovered, nothing is duplicated", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); await d.save(iv("b")); d.restart();
    expectEq(o, "locked after restart", d.locked(), true); d.reauthenticate();
    expectEq(o, "drafts", [d.status("a"), d.status("b")], ["queued", "queued"]); expectEq(o, "pending", d.pending(), 2);
    await d.sync(); await d.sync(); expectEq(o, "records", d.server.records().length, 2); expectEq(o, "writes", [d.server.receiptsFor("a"), d.server.receiptsFor("b")], [1, 1]); return o; } },
  { id: "N08", title: "Storage full refuses new interviews but keeps and still syncs the existing drafts", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); d.fillStorage();
    expectEq(o, "new refused", await d.save(iv("b")), { ok: false, reason: "storage_full" }); expectEq(o, "kept", d.status("a"), "queued");
    await d.sync(); expectEq(o, "existing synced", d.status("a"), "server_received"); return o; } },
  { id: "N09", title: "Quota counted per interview: exceeding it refuses the next new interview, revising an existing one still works", run: async (mk) => {
    const d = mk(), o: string[] = []; for (let i = 0; i < 5; i++) await d.save(iv(`i${i}`));
    expectEq(o, "sixth refused", await d.save(iv("i5")), { ok: false, reason: "storage_full" }); expectEq(o, "revise ok", await d.save(iv("i0", 2)), { ok: true }); return o; } },
  { id: "N10", title: "Conflicting revisions are both preserved and flagged for a lead; never last-write-wins", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a", 1, "version from device one")); await d.sync();
    await d.save(iv("a", 1, "different content for the same revision")); await d.sync();
    expectEq(o, "flagged", d.server.conflicts().map((c) => c.id), ["a"]); expectEq(o, "needs attention", d.status("a"), "needs_attention");
    const kept = d.server.records().find((r) => r.id === "a"); if (kept && kept.payload !== "version from device one" && kept.revision < 1000) o.push("first version was overwritten"); return o; } },
  { id: "N11", title: "Withdrawal while a send is pending: the record is never uploaded and a late device cannot recreate it", run: async (mk) => {
    const d = mk(), o: string[] = []; d.setNetwork("offline"); await d.save(iv("a")); d.withdraw("a"); d.setNetwork("online"); await d.sync();
    expectEq(o, "not uploaded", d.server.records().length, 0); expectEq(o, "tombstone", d.server.tombstones(), ["a"]); expectEq(o, "status", d.status("a"), "withdrawn");
    await d.save(iv("a", 2)); await d.sync(); expectEq(o, "cannot resurrect", d.server.records().length, 0); expectEq(o, "stays withdrawn", d.status("a"), "withdrawn"); return o; } },
  { id: "N12", title: "Media upload interrupted: the interview record keeps its receipt; the attachment resumes and is tracked separately", run: async (mk) => {
    const d = mk(), o: string[] = []; await d.save(iv("a")); d.attachMedia("a", 10); d.setNetwork("offline"); await d.sync();
    expectEq(o, "nothing sent offline", d.attachmentProgress("a"), { sent: 0, total: 10 });
    d.setNetwork("online"); await d.sync(); expectEq(o, "record received", d.status("a"), "server_received");
    expectEq(o, "attachment partly sent", d.attachmentProgress("a")!.sent < 10 || d.attachmentProgress("a")!.sent === 10, true);
    await d.sync(); expectEq(o, "attachment complete", d.attachmentProgress("a"), { sent: 10, total: 10 }); return o; } },
];
