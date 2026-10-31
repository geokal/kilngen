# ADR-0003: Preserving custom code with a generated branch and 3-way merge

- Status: accepted
- Date: 2026-10-31

## Context

Users edit generated SDKs, CLIs and docs (README tweaks, extra helpers, patched methods). Regeneration must not wipe those edits, and must not need a hosted service.

## Decision

Each output repo has a `generated` branch that contains only pristine generator output, plus the user's integration branch (default `main`).

1. Generate into a temp worktree of `generated`, format it, and commit.
2. `git merge` `generated` into the integration branch. Git's 3-way merge uses the previous generated commit as the base, so user edits and generator changes combine; real conflicts are left for the user, as with any merge.
3. Record the last generated commit SHA per target in `.kilngen/state/`.

Docs repos go through the same writer.

## Consequences

- Uses plain git; no custom patch format and no service.
- Formatting before commit is mandatory, otherwise formatter churn causes spurious conflicts.
- Stable naming (a name lock in `.kilngen/state/`) is needed so renames in the spec do not appear as delete-and-add.
- Users need to resolve conflicts with normal git tools; `kilngen` should print clear instructions when that happens.
