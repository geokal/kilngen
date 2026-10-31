# kilngen

**kilngen** turns an OpenAPI spec plus a `kilngen.yml` config into SDKs, a docs site, a CLI, an MCP server and a Terraform provider. It runs entirely on your machine: no account, no hosted build service, no telemetry.

> Status: **pre-alpha**. Only workspace discovery and config/spec linting exist so far; no code generation yet. See the [roadmap](docs/plan/project-plan.md#5-mvp-roadmap).

## Try it

Requires Node.js 22 and pnpm 9 (`corepack enable`).

```sh
pnpm install && pnpm build
node packages/cli/dist/index.js lint --workspace examples/petstore
node packages/cli/dist/index.js workspace status --workspace examples/petstore
node packages/cli/dist/index.js workspace init path/to/your/api
```

`kilngen lint` validates `kilngen.yml` against its schema, checks cross-references (pagination schemes, auth schemes, target prerequisites) and checks every mapped endpoint and model against the OpenAPI spec. Diagnostics have stable codes (`K0201`) and `file:line:col` locations; `--format json` is available for CI. Editors can validate config files with [`schemas/kilngen.schema.json`](schemas/kilngen.schema.json) and [`schemas/workspace.schema.json`](schemas/workspace.schema.json).

## Repository layout

| Path                 | Contents                                                                                |
| -------------------- | --------------------------------------------------------------------------------------- |
| `packages/core`      | Config schema (zod), YAML source mapping, diagnostics, OpenAPI loading and cross-checks |
| `packages/workspace` | `.kilngen/workspace.json` discovery, `local.json` overrides, `workspace init`           |
| `packages/cli`       | The `kilngen` command                                                                   |
| `schemas/`           | JSON Schemas generated from the zod schemas (`pnpm schemas`)                            |
| `examples/petstore`  | A small spec, config and workspace used by tests and CI                                 |
| `docs/`              | Project plan and ADRs                                                                   | See the [roadmap](docs/plan/project-plan.md#5-mvp-roadmap). |

## How it works

```
OpenAPI specs + overlays ─┐
kilngen.yml ──────────────┼─► loader / config parser ─► resolver ─► Resolved IR ─► diagnostics gate
.kilngen/workspace.json ──┘                                                          │
          ┌────────────────────────────────────────────────────────────────────────┘
          ▼
  per-language lowering ─► TS / Python / Go emitters ─► MCP · CLI · Terraform · docs
          ─► formatters ─► output writer (3-way merge) ─► local git repos ─► verify ─► release ─► local registries
```

Full design: [docs/plan/project-plan.md](docs/plan/project-plan.md). Key decisions are recorded as [ADRs](docs/adr/).

## Files in a kilngen project

| File                                  | Purpose                                                           | Committed? |
| ------------------------------------- | ----------------------------------------------------------------- | ---------- |
| `kilngen.yml`                         | What to generate: resources, targets, auth, pagination, options   | yes        |
| `.kilngen/workspace.json`             | Where things are: spec paths, config path, output path per target | yes        |
| `.kilngen/local.json`                 | Per-developer overrides of the workspace                          | no         |
| `.kilngen/state/`                     | Generator state: last generated SHAs, stable-name lock            | yes        |
| `.kilngen/cache/`, `.kilngen/builds/` | Caches and scratch builds                                         | no         |

## Licensing

kilngen is [MIT licensed](LICENSE). Code that kilngen generates for you belongs to you; see [OUTPUT-LICENSE.md](OUTPUT-LICENSE.md).

kilngen is an independent project, not affiliated with or endorsed by Stainless. See [CLEANROOM.md](CLEANROOM.md) for how we keep it that way.
