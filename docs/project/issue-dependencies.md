# Dependency map

Generated from developer-issue-allocation.json. No dates, product implementation or participant data. GitHub B assignment is pending invitation acceptance; labels reserve B work as requested. Issue #1 was completed concurrently in PR #137 and is preserved; remaining work begins at #6.

Authoritative current edges: [allocation JSON](developer-issue-allocation.json), [machine-readable dependency map](issue-dependencies.json), and [implementation order](implementation-order.md). The old single blocker category is now explicitly separated into hard, integration, soft and operational dependencies.

Hard edges: 255; integration edges: 113; soft: 10; operational: 2. Both hard and hard+integration graphs are acyclic.

```mermaid
flowchart LR
 A0["A: #1 → #6 → #9 → #10"] --> A1["A: private services, GIS, surveys, GPS, sync"]
 B0["B: #12/#24/#5 can start now"] --> B1["B: public map, content and reporting mocks"]
 A0 --> B1
 A1 --> G["Incremental map/media/analytics/field integration gates"]
 B1 --> G
 G --> Q["Privacy, devices, restore and research evidence"]
 Q --> L["#126 release → #127 handover"]
```

No hard dependency was simply deleted: reclassified original blockers and their rationale are preserved per issue in allocation JSON and baseline snapshot. All actual issue numbers remain mapped to stable catalogue IDs.
