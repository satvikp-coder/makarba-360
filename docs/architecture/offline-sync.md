# Offline capture and synchronization

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Decision gate: prototype PWA against real Android Chrome and iOS Safari storage, key recovery, GPS and background restrictions before real collection. IndexedDB is not inherently encrypted, persistent or eviction-proof. If device-policy and key-management controls cannot satisfy institutional risk review, use ODK Collect/Central or approved KoboToolbox with an import adapter; custom offline collection remains blocked until proven.

Proposed vault: AES-GCM authenticated encryption with random IV per draft/blob, per-device random data key wrapped by researcher passphrase-derived key; key is unlocked only in memory and locks on inactivity/app background. No persistent plaintext key or tokens; no recovery by bypassing passphrase. XSS during unlocked use remains a risk. Require device encryption, screen lock, minimal collection, same-day sync and managed devices where feasible. Forgotten key or browser eviction may lose drafts; require researcher training, quota checks and a recovery drill, never claim guaranteed durability. Request persistent storage but handle denial. Backups of unsynced data only through institution-approved encrypted transfer.

Online sign-in and assigned cached immutable forms/places are required before departure. Offline unlock only for previously enrolled researcher within a provisional 24-hour offline window; cannot create accounts, approve/publish, export or silently extend authentication. Server cannot instantly revoke an offline device; local collection after revocation is quarantined on reconnect. Expired offline session locks sensitive screens while retaining encrypted drafts; online reauth required to sync.

States: editing → locally_saved → queued → sending → server_received → submitted → under_review → approved / changes_requested / rejected; media has independent pending/uploading/quarantined/approved states. Save shows success only after IndexedDB transaction completion; autosave has visible last-save time, never a misleading green badge before persistence. Quota and write errors stop starting additional interviews and preserve existing drafts.

Each interview UUID and operation UUID is generated client-side. Server unique(operation_id, actor_id) with request hash and receipt; unique(interview_id). One transaction locks/creates interview, verifies base_revision and form version, writes answers/position/subject links/audit, then stores receipt. Same key+hash returns receipt; same key+changed payload is 409. Concurrent sends yield one write; response lost after commit is recovered by receipt lookup. No time-based duplicate rule deletes genuine similar interviews.

Edits use new operation IDs and baseRevision; submitted records require correction revision. Conflicts preserve both revisions and show lead resolution; never last-write-wins on consent/GPS/answers. Retry transient failures with exponential jitter and cap; persistent rejection is actionable and retained. On reconnect verify account, form compatibility and pending server withdrawals before upload. Attachment manifests are content-hashed, resumable multipart where available, and independently retried. Interview may sync before photo; publication waits for approved complete derivatives. Clear local payload only after acknowledged server checksum/revision and retention policy; device-loss and clean-browser tests prove limitations.

Service worker caches only shell, permitted reference map data and immutable forms, never private API responses/original uploads. Do not bulk-download standard OSM tiles. Background Sync is an enhancement; foreground queue resume and explicit retry are required. Fallback importer preserves source instance UUID, form version, exact interview/subject distinction, consent and audit; malformed submissions are quarantined, never silently coerced.

Replay retention: keep minimal operation ID/hash/receipt for the accepted interview lifetime and an institution-approved replay window after purge. Retain non-content withdrawn/deleted entity tombstones so a late device or fallback reimport cannot recreate a withdrawn interview. Never retain raw payload solely for idempotency. Vault passphrase derivation parameters, random salt and authenticated-encryption format are versioned; WebCrypto PBKDF2 tuning and key-loss behavior require the real-device feasibility review before this proposed vault can be selected.

## Photo metadata, credit and permissions model (#61)

Implemented as `packages/place-content/src/media.ts` (domain level, synthetic fixtures; no upload pipeline, storage or API exists, so this is mock/model-level only. Live prerequisites #60 upload quarantine and #37 consent are not claimed).

**Asset tree.** Every asset is a private original (`derivedFrom = null`) or a derivative of another asset, with the list of transforms applied (resize, crop, strip_exif, redact_faces, redact_plates). `lineage()` walks to the original and reports a missing parent or a cycle as an error, never as a pass.

**Recorded per asset:** creator, capture date with precision (or both null: unknown, never guessed), camera bearing 0 to <360 only if known, original-source reference, rights/licence, participant consent state, whether identifiable people appear, publication permission, withdrawn flag, EXIF-stripped flag, redaction-review state, alt text, credit, public URL.

**Rule: rights, consent and withdrawal of the original (and every link in the chain) govern every copy.** A public copy is refused when: it is itself an original; any link is withdrawn or has withdrawn consent; the original's rights are unknown or all-rights-reserved; consent is research-only or never requested; identifiable people appear without granted consent or without a completed face/plate redaction review; creator or capture date is unknown; EXIF is not stripped; alt text or credit is missing; or the public URL is not https or points at original storage. Reasons are returned as plain sentences for the editor.

**Withdrawal** cascades to the asset and all descendants (copies lose their permission and URL). The function is pure; the caller must also purge CDN/cache and rebuild the publication snapshot (Developer A's publication job, not covered here).

**Public projection** exposes only id, location, URL, alt, credit, licence and capture date. Creator identity, source reference, bearing and consent details stay private.

**Limitations.** Whether a licence value was truthfully recorded cannot be checked by software: rights approval is a human step (see human-action list). The model does not detect faces or plates; it only records that a review happened. Mapping to the `Media` contract fields not shown here (content type, dimensions, format, fallback) is added when the pipeline produces derivatives.
