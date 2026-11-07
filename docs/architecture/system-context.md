# System context and trust boundaries

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

```mermaid
flowchart LR
 V[Public visitor] --> P[Read-only public atlas]
 R[Authorised researcher] --> F[Private field PWA]
 L[Research lead] --> A[Private review dashboard]
 F --> API[Private authenticated API]
 A --> API
 API --> D[(Restricted PostGIS and originals)]
 D --> W[Review and publication worker]
 W --> S[(Approved public projection)]
 P --> Q[Read-only API]
 Q --> S
 P --> T[Licensed map tiles and optional panorama provider]
 I[Institutional ethics and source verification] -. release gates .-> W
```

External IdP authenticates team accounts; it never authorizes publication alone. Device, browser, internet, application, database, object storage and third-party viewers are separate trust boundaries. Tile/viewer providers can observe visitor network requests; third-party embeds load only after user action with privacy notice.
