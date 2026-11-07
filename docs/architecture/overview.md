# System architecture

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Use a TypeScript monorepo with React/Vite public, field and admin apps; Express API; PostgreSQL/PostGIS; private S3-compatible originals and separate approved public derivatives. Shared packages hold runtime validation/OpenAPI types, GIS rules and accessible UI primitives. Use Tailwind tokens and accessible primitives, ECharts with tables, Pannellum for owned panoramas. Select supported package versions and lockfiles during foundation work, not fictional version pins here.

A modular monolith keeps a student team deployable: auth, GIS, fieldwork, review, evidence, media, publication, analytics and exports are modules. A worker process from the same codebase handles media, aggregation, publication invalidation and exports via PostgreSQL-backed jobs; no Redis/Kafka/microservices initially. API schemas validate untrusted input server-side; generated client types are not validation.

Public API runs with a database role restricted to published projection tables. Private API performs scoped authorization and never serializes raw models to public routes. Worker owns restricted processing grants. Public copies contain no private IDs, exact interview times or EXIF GPS. Cookies are limited to private origins; public caching cannot cache private responses.

Flow: researcher → local protected draft → authenticated idempotent transaction → restricted relational records → lead review → aggregation/disclosure checks → immutable approved snapshot → allowlisted public API/CDN. Observations, opinions, historical claims and verified facts have distinct evidence types. See ADRs, data model, API and offline design for constraints.
