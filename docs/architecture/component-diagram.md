# Components and data flow

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

```mermaid
flowchart TD
 subgraph Device
 UI[Field screens] --> Vault[Protected IndexedDB draft vault]
 Vault --> Queue[Operation queue and attachment manifests]
 end
 Queue --> Auth[Session and RBAC middleware]
 Auth --> Validate[Runtime validation and revision check]
 Validate --> Tx[Transaction: interview + answers + operation receipt]
 Tx --> DB[(PostGIS private schema)]
 DB --> Review[Review state machine]
 Review --> Media[Scan, redact, strip metadata]
 Review --> Agg[Versioned aggregation and disclosure checks]
 Media --> Approval[Independent publication approval]
 Agg --> Approval
 Approval --> Projection[(Public schema snapshot)]
 Projection --> Read[Public GET API and cache]
```

Failure boundaries: metadata transaction succeeds independently of attachment completion; missing media remains unpublished. Job claims use DB locking, bounded retries and dead-letter review. Jobs include input revision and unique operation key to prevent duplicate derivatives. Public invalidation occurs on edits, consent changes and withdrawal before replacement publication.
