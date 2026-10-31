# ADR-0001: TypeScript for the generator engine

- Status: accepted
- Date: 2026-10-31

## Context

kilngen generates code in several languages (TypeScript, Python, Go, plus a Go CLI and Terraform provider). The engine, config tooling, docs renderer (Astro) and MCP generator need to share one in-memory IR. Candidates were TypeScript (Node 22) and Go.

## Decision

Write the engine, CLI, config tooling and all emitters in **TypeScript on Node 22 LTS**, as a pnpm monorepo. Emitters produce text; they do not need to run in the target language. Target-language toolchains (gofmt, ruff, terraform) are invoked as external processes for formatting and verification only.

## Consequences

- One language for the IR, the emitters, the docs site (Astro) and the MCP server, so the IR types are shared directly with no serialization boundary.
- The best OpenAPI tooling (parsers, bundlers, overlay support, JSON Schema validators) is in the JS ecosystem.
- Distribution is heavier than a single Go binary. We will ship a Node single-executable build and a Docker image; revisit if install size becomes a real complaint.
- Generated Go code (CLI, Terraform) is verified by running `go build`/`go test` in CI, not by type-checking inside the engine.
