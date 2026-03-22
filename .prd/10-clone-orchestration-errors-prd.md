# PRD 10: Clone Orchestration and Error Model

## Objective

Wire all clone subflows into `clone` command orchestration with a coherent typed error model.

## Scope / Out of Scope

- In scope: CLI command addition, input validation, service orchestration order, error wrapping/context.
- Out of scope: protocol/parser internals already covered by earlier PRDs.

## Inputs / Outputs

- Inputs: `remoteUrl`, `targetDirectory`.
- Output: completed clone side effects (objects, refs, checkout) and user-visible success/failure.

## Dependencies

- Requires `08-refs-and-head-materialization-prd.md`.
- Requires `09-working-tree-checkout-prd.md`.

## Acceptance Criteria

- `clone <url> <dir>` command exists and runs end-to-end.
- Failures include stage context (discover, negotiate, parse-pack, write-objects, checkout).
- Partial clone failures do not corrupt existing repositories outside target dir.

## Implementation Notes

- Update:
  - [`app/adapters/cli-input-adapter.ts`](app/adapters/cli-input-adapter.ts)
  - [`app/ports/git-input-port.ts`](app/ports/git-input-port.ts)
  - [`app/application/services/git.ts`](app/application/services/git.ts)
- Keep orchestration linear and auditable:
  1. init repo
  2. discover refs
  3. fetch pack
  4. parse/reconstruct/write objects
  5. write refs/HEAD
  6. checkout.

## Validation Plan

- Happy-path clone against public GitHub repos.
- Inject failures at each stage and verify error messages and cleanup behavior.

## Risks / Open Questions

- Cleanup policy for partially written target directory on failure.
