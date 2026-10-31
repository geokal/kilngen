# Contributing to kilngen

Thanks for helping. Please read [CLEANROOM.md](CLEANROOM.md) first; every PR must follow it.

## Setup

Requires Node.js 22 and pnpm 9 (`corepack enable` gives you the right pnpm).

```sh
pnpm install
pnpm build       # compile all packages
pnpm test        # vitest
pnpm lint        # eslint + prettier check
pnpm typecheck   # tsc --noEmit across packages
pnpm schemas     # regenerate schemas/*.json from the zod schemas
```

CI fails if `schemas/` is out of date, so run `pnpm schemas` after changing a config or workspace schema.

## Pull requests

- Keep PRs focused. Add tests for behavior changes.
- Record significant design decisions as an ADR in `docs/adr/` (copy `0000-template.md`).
- Sign off your commits (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).
