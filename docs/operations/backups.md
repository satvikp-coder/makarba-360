# Backup and disaster recovery

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Proposed RPO ≤24h restricted data, RTO ≤8h after incident authorization; verify feasibility against selected host, do not claim achieved. Daily encrypted database backups plus object versioning/manifest checks; rolling 35-day retention pending institutional policy; separate keys/access from production app. Protect consent and lineage together with source records.

Monthly and pre-release isolated restore drill: provision restricted target → restore DB/extensions/roles and object manifests → verify checksums/record counts/permissions → replay withdrawal/deletion tombstones before allowing access → test publication integrity and restricted-role denial → record actual RPO/RTO → destroy restricted test target under policy. Never restore directly into public-serving environment. Backup deletion ages out under approved policy; withdrawal manifests survive sufficiently to reapply restrictions. Key loss is tested as a documented unrecoverable failure unless approved escrow exists.
