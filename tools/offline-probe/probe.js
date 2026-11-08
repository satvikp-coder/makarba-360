// Offline storage / key / recovery probe (issue #54). SYNTHETIC DATA ONLY: nothing here is a participant record.
// Run it on real phones (Android Chrome, iPhone Safari) and attach the downloaded JSON report to issue #54.
// Passing in a desktop browser is NOT device evidence; the report records the user agent so that cannot be confused.

const DB = "makarba-offline-probe";
const STORE = "kv";
const KEY_ID = "vault-key";
const DRAFT_ID = "draft-marker";
const TEXT = new TextEncoder();
const DEC = new TextDecoder();

/** @typedef {{id:string,title:string,status:'pass'|'fail'|'unsupported'|'info'|'manual',detail:string}} Result */

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("database open blocked"));
  });
}
const tx = (db, mode, fn) => new Promise((resolve, reject) => {
  const t = db.transaction(STORE, mode);
  let out;
  const s = t.objectStore(STORE);
  const req = fn(s);
  if (req) req.onsuccess = () => { out = req.result; };
  // a write only counts once the transaction itself completes, not when the request is queued
  t.oncomplete = () => resolve(out);
  t.onerror = () => reject(t.error);
  t.onabort = () => reject(t.error || new Error("transaction aborted"));
});
const put = (db, k, v) => tx(db, "readwrite", (s) => s.put(v, k));
const get = (db, k) => tx(db, "readonly", (s) => s.get(k));
const del = (db, k) => tx(db, "readwrite", (s) => s.delete(k));

const ok = (id, title, detail) => ({ id, title, status: "pass", detail });
const bad = (id, title, detail) => ({ id, title, status: "fail", detail });
const info = (id, title, detail) => ({ id, title, status: "info", detail });
const unsupported = (id, title, detail) => ({ id, title, status: "unsupported", detail });

async function guard(id, title, fn) {
  try { return await fn(); } catch (e) { return bad(id, title, `threw ${e && e.name}: ${e && e.message}`); }
}

export async function detect() {
  const f = { secureContext: self.isSecureContext, indexedDB: "indexedDB" in self, webCrypto: !!(self.crypto && self.crypto.subtle), serviceWorker: "serviceWorker" in navigator, storageManager: !!(navigator.storage && navigator.storage.estimate), persist: !!(navigator.storage && navigator.storage.persist), geolocation: "geolocation" in navigator };
  const missing = Object.entries(f).filter(([, v]) => !v).map(([k]) => k);
  return { id: "features", title: "Required browser features", status: missing.length ? "fail" : "pass", detail: JSON.stringify(f) + (missing.length ? `; missing: ${missing.join(", ")}` : "") };
}

export async function storageQuota() {
  const id = "quota", title = "Storage quota and persistence";
  return guard(id, title, async () => {
    if (!navigator.storage?.estimate) return unsupported(id, title, "navigator.storage.estimate is not available");
    const e = await navigator.storage.estimate();
    const before = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    const granted = navigator.storage.persist ? await navigator.storage.persist() : null;
    const mb = (n) => (n == null ? "n/a" : (n / 1048576).toFixed(1) + " MB");
    return info(id, title, `quota ${mb(e.quota)}, used ${mb(e.usage)}; persisted before: ${before}; persist() granted: ${granted}. A browser can still evict data when persistence is not granted, and quota can be tiny in private browsing.`);
  });
}

export async function idbRoundTrip() {
  const id = "idb", title = "IndexedDB write, read back, completion semantics";
  return guard(id, title, async () => {
    const db = await openDb();
    const blob = new Uint8Array(1024 * 1024).map((_, i) => i % 251);
    await put(db, "blob", blob);
    const back = await get(db, "blob");
    const same = back && back.length === blob.length && back.every((v, i) => v === blob[i]);
    await del(db, "blob");
    db.close();
    return same ? ok(id, title, "1 MB synthetic blob written and read back identically after the transaction completed") : bad(id, title, "read-back differed from what was written");
  });
}

export async function writeUntilLimit(capMb = 64) {
  const id = "limit", title = "Behaviour when storage fills";
  return guard(id, title, async () => {
    const db = await openDb();
    const chunk = new Uint8Array(4 * 1024 * 1024);
    let n = 0, err = null;
    try { for (; n < capMb / 4; n++) await put(db, `fill-${n}`, chunk); } catch (e) { err = e; }
    for (let i = 0; i <= n; i++) { try { await del(db, `fill-${i}`); } catch { /* cleanup best effort */ } }
    db.close();
    return err
      ? ok(id, title, `write failed after ${n * 4} MB with ${err.name}: the app must stop starting interviews and keep existing drafts (specified behaviour)`)
      : info(id, title, `${capMb} MB written without error; the limit is higher than the probe cap, so quota exhaustion was not exercised on this device`);
  });
}

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", TEXT.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function pbkdf2Timing() {
  const id = "pbkdf2", title = "Passphrase key derivation time on this device";
  return guard(id, title, async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const rows = [];
    for (const it of [100_000, 310_000, 600_000]) {
      const t = performance.now();
      await deriveKey("synthetic passphrase", salt, it);
      rows.push(`${it}: ${Math.round(performance.now() - t)} ms`);
    }
    return info(id, title, `PBKDF2-SHA256 ${rows.join("; ")}. Pick an iteration count that is slow enough to resist guessing but still unlocks in a few seconds on the oldest field phone.`);
  });
}

export async function vaultRoundTrip() {
  const id = "vault", title = "Encrypt and decrypt a synthetic draft (AES-GCM, passphrase-derived key)";
  return guard(id, title, async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey("synthetic passphrase", salt, 100_000);
    const plain = TEXT.encode(JSON.stringify({ synthetic: true, note: "not a participant record" }));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    const back = DEC.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
    let wrongRejected = false, tamperRejected = false;
    try { await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await deriveKey("wrong", salt, 100_000), ct); } catch { wrongRejected = true; }
    const t = ct.slice(); t[0] ^= 1;
    try { await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, t); } catch { tamperRejected = true; }
    const plainVisible = new TextDecoder().decode(ct).includes("synthetic");
    const good = back.includes("synthetic") && wrongRejected && tamperRejected && !plainVisible;
    return (good ? ok : bad)(id, title, `round trip ok: ${back.includes("synthetic")}; wrong passphrase rejected: ${wrongRejected}; tampered ciphertext rejected: ${tamperRejected}; plaintext visible in ciphertext: ${plainVisible}`);
  });
}

export async function keyStorage() {
  const id = "keystore", title = "Non-extractable key stored in IndexedDB survives a reload";
  return guard(id, title, async () => {
    const db = await openDb();
    const existing = await get(db, KEY_ID);
    if (existing) {
      // Second visit: the key stored on the previous load must still decrypt.
      const iv = new Uint8Array(12);
      const ct = await get(db, "keyed-ct");
      try {
        const back = DEC.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, existing, ct));
        db.close();
        return ok(id, title, `key recovered from the previous page load and decrypted: "${back}". extractable: ${existing.extractable}`);
      } catch (e) { db.close(); return bad(id, title, `stored key could not decrypt after reload: ${e.name}`); }
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    let exportRefused = false;
    try { await crypto.subtle.exportKey("raw", key); } catch { exportRefused = true; }
    const iv = new Uint8Array(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, TEXT.encode("synthetic draft")));
    await put(db, KEY_ID, key); await put(db, "keyed-ct", ct);
    db.close();
    return info(id, title, `key created (extractable: ${key.extractable}, export refused: ${exportRefused}) and stored. RELOAD THIS PAGE to test recovery. Note: a key kept next to the data protects against casual copying only; it does not protect against someone who can run code on the unlocked device.`);
  });
}

export async function plaintextWarning() {
  const id = "plaintext", title = "Plaintext in IndexedDB is readable by anyone with the device";
  return guard(id, title, async () => {
    const db = await openDb();
    await put(db, "plain-sample", { synthetic: "this value is stored unencrypted", note: "open browser developer tools > Application > IndexedDB to see it (desktop) or use remote debugging" });
    const back = await get(db, "plain-sample");
    await del(db, "plain-sample");
    db.close();
    return info(id, title, `a plain object was stored and read back (${back ? "ok" : "failed"}). IndexedDB is not encrypted by the browser: unencrypted storage must never be called safe. Only the AES-GCM vault above provides confidentiality, and only while the key is locked.`);
  });
}

export async function recoveryMarker() {
  const id = "recovery", title = "Draft survives closing the browser";
  return guard(id, title, async () => {
    const db = await openDb();
    const m = await get(db, DRAFT_ID);
    if (m) { db.close(); return ok(id, title, `marker from the earlier visit found: written ${m.at}. Compare with how you closed the app (swipe-kill, low memory, airplane mode, restart).`); }
    await put(db, DRAFT_ID, { at: new Date().toISOString(), synthetic: true });
    db.close();
    return { id, title, status: "manual", detail: "marker written. NOW: kill the browser app completely (swipe away), reopen this page and press Run again. Expected: this row turns green. Record in the notes whether it did." };
  });
}

export async function serviceWorkerCheck() {
  const id = "sw", title = "Service worker caches the shell for offline reload";
  return guard(id, title, async () => {
    if (!("serviceWorker" in navigator)) return unsupported(id, title, "service workers are not available");
    const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    return { id, title, status: "manual", detail: `registered (scope ${reg.scope}); caches: ${keys.join(", ") || "none yet"}. NOW: turn on airplane mode and reload this page. Expected: the page still loads and the line below says "served from the service worker cache". Record the result in the notes.` };
  });
}

export async function geolocationCheck() {
  const id = "gps", title = "Location permission state";
  return guard(id, title, async () => {
    if (!navigator.permissions?.query) return unsupported(id, title, "Permissions API is not available (common on iOS Safari)");
    const p = await navigator.permissions.query({ name: "geolocation" });
    return info(id, title, `geolocation permission is "${p.state}". The field app must handle denied/unavailable explicitly; the probe never requests your position.`);
  });
}

export const ALL = [detect, storageQuota, idbRoundTrip, writeUntilLimit, pbkdf2Timing, vaultRoundTrip, keyStorage, plaintextWarning, recoveryMarker, serviceWorkerCheck, geolocationCheck];

export async function runAll() {
  const results = [];
  for (const t of ALL) results.push(await t());
  return results;
}

export function buildReport(results, notes) {
  const failed = results.filter((r) => r.status === "fail").length;
  return {
    probe: "makarba-offline-probe", version: 1, issue: 54, syntheticDataOnly: true,
    runAt: new Date().toISOString(), userAgent: navigator.userAgent, platform: navigator.platform ?? null,
    isSecureContext: self.isSecureContext, notes: notes || "",
    summary: { total: results.length, fail: failed, manual: results.filter((r) => r.status === "manual").length },
    results,
    interpretation: "A report is evidence only if it comes from a real device and the manual steps were completed and noted. This probe does not choose between the PWA and the ODK/Kobo path; the research lead and developers do, using these reports from at least one Android and one iOS device.",
  };
}

export async function clearAll() {
  await new Promise((resolve) => { const r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
  if (self.caches) for (const k of await caches.keys()) await caches.delete(k);
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
  for (const r of regs) await r.unregister();
}
