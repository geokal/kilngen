# ADR-0002: A resolved IR between specs and emitters

- Status: accepted
- Date: 2026-10-31

## Context

Five output types (SDKs, docs, CLI, MCP, Terraform) all need the same facts about the API: resources, methods, models, auth, pagination, errors. Raw OpenAPI is too loose for that: `$ref` graphs, `allOf` composition, inconsistent naming, and per-operation quirks would be re-interpreted differently by each emitter.

## Decision

1. Load and bundle the specs, apply overlays, and parse `kilngen.yml` and `.kilngen/workspace.json`.
2. A **resolver** joins them into a single **Resolved IR**: a typed, fully dereferenced, language-neutral model with stable IDs for every resource, method and type. Config decisions (resource grouping, pagination schemes, names) are applied here, not in emitters.
3. The **diagnostics engine** runs over the IR; any `error` stops generation (the "gate").
4. Each language gets a **lowering** pass (IR → language IR) that applies naming conventions and type mapping. Emitters and SDK-metadata export read only the lowered IR.
5. The previous IR is stored under `.kilngen/state/` so `kilngen diff` can compute API changes for semver and changelogs.

## Consequences

- Emitters are simple and testable with IR fixtures, without OpenAPI.
- Docs show the exact names each SDK uses, because they read lowered IRs.
- The IR is a public contract for third-party emitters, so it needs versioning (`ir_version`) from day one.
