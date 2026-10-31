# kilngen

**kilngen** turns an OpenAPI spec plus a `kilngen.yml` config into SDKs, a docs site, a CLI, an MCP server and a Terraform provider. It runs entirely on your machine: no account, no hosted build service, no telemetry.

> Status: **pre-alpha, design phase**. No runnable code yet. See the [roadmap](docs/plan/project-plan.md#5-mvp-roadmap).

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

| File | Purpose | Committed? |
| --- | --- | --- |
| `kilngen.yml` | What to generate: resources, targets, auth, pagination, options | yes |
| `.kilngen/workspace.json` | Where things are: spec paths, config path, output path per target | yes |
| `.kilngen/local.json` | Per-developer overrides of the workspace | no |
| `.kilngen/state/` | Generator state: last generated SHAs, stable-name lock | yes |
| `.kilngen/cache/`, `.kilngen/builds/` | Caches and scratch builds | no |

## Licensing

kilngen is [MIT licensed](LICENSE). Code that kilngen generates for you belongs to you; see [OUTPUT-LICENSE.md](OUTPUT-LICENSE.md).

kilngen is an independent project, not affiliated with or endorsed by Stainless. See [CLEANROOM.md](CLEANROOM.md) for how we keep it that way.
