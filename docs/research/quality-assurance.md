# Research data quality procedure

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Daily reconciliation compares device interview UUID manifests, sync receipts and server counts; unresolved discrepancies block device clearing. Check consent scopes, questionnaire hash, timestamp anomalies, independent subject links, GPS quality/provenance and duplicate candidates. Never delete similar responses automatically. Record correction reasons with old/new revisions.

Media QA verifies checksum, date/precision, direction, place link, creator, rights, identifiable-person consent and derivative redaction. Evidence QA triangulates historical claims and distinguishes observation/account/fact. Analytics QA reruns frozen fixtures, counts distinct interviews and topic answers with explicit denominators, missing/unsure and suppression. Lead reviews discrepancies and signs release snapshot; audit logs record decision metadata without copying sensitive payloads. Targets track progress, not truth. No dataset is complete because a spreadsheet has no blanks.
