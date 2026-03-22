# PRD 08: Refs and HEAD Materialization

## Objective

Write branch ref files and `HEAD` so cloned repository metadata points to the fetched default branch commit.

## Scope / Out of Scope

- In scope: determine branch name, write `refs/heads/<branch>`, write `.git/HEAD`.
- Out of scope: working tree file checkout.

## Inputs / Outputs

- Inputs:
  - selected target branch/ref
  - target commit hash.
- Output:
  - `.git/HEAD`
  - `.git/refs/heads/<branch>`.

## Dependencies

- Requires `07-object-reconstruction-write-prd.md`.

## Acceptance Criteria

- `HEAD` contains `ref: refs/heads/<branch>\n`.
- Branch ref file contains commit hash and newline.
- `git show --no-patch HEAD` works from cloned directory.

## Implementation Notes

- Extend repository adapter with helper methods for writing refs if needed.
- Use explicit newline semantics to match git expectations.

## Validation Plan

- `git rev-parse HEAD` and `git cat-file -t HEAD` succeed.
- Validate resolved branch name matches advertised symref fallback logic.

## Risks / Open Questions

- Repositories with detached HEAD advertisements (rare for this stage).
