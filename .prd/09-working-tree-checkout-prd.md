# PRD 09: Working Tree Checkout

## Objective

Materialize files/directories into the target clone directory from the fetched commit tree.

## Scope / Out of Scope

- In scope: commit parse, recursive tree walk, blob writes, executable bit handling.
- Out of scope: index file population and advanced checkout conflict handling.

## Inputs / Outputs

- Inputs:
  - HEAD commit hash
  - local object store.
- Output:
  - working tree files under target directory with expected content/layout.

## Dependencies

- Requires `07-object-reconstruction-write-prd.md`.

## Acceptance Criteria

- Random repository file read by tester matches upstream content.
- Directory hierarchy matches tree entries.
- Executable mode entries (`100755`) are emitted with executable permissions.

## Implementation Notes

- Reuse `decodeObject` tree/commit/blob parsing.
- Add repository adapter methods for:
  - ensuring directories
  - writing checkout files outside `.git`.
- Skip `.git` traversal and preserve relative paths.

## Validation Plan

- Compare one or more files against `git clone` output in temp directories.
- Run `git status --porcelain` in clone target (should be clean or near-clean depending on checkout choices).

## Risks / Open Questions

- Symlink mode (`120000`) handling may vary by platform; define fallback behavior.
