# PRD 11: Validation Matrix and Definition of Done

## Objective

Define a deterministic validation suite that proves stage 7 clone correctness and prevents regressions in stages 1-6.

## Scope / Out of Scope

- In scope: command checks, git interop checks, smoke matrix for multiple public repos.
- Out of scope: CI pipeline redesign.

## Inputs / Outputs

- Inputs: built app binary/script and public repository URLs.
- Output: pass/fail matrix with reproducible command logs.

## Dependencies

- Requires `10-clone-orchestration-errors-prd.md`.

## Acceptance Criteria

- `clone` succeeds for at least one public test repo used by challenge harness.
- Tester-equivalent assertions pass:
  - random file content check
  - commit object attribute readability.
- Existing commands (`init`, `cat-file`, `hash-object`, `ls-tree`, `write-tree`, `commit-tree`) remain green.

## Implementation Notes

- Suggested local verification sequence:
  - `bun lint:check`
  - clone command into temp dir
  - `git -C <dir> cat-file -t HEAD`
  - `git -C <dir> show --no-patch HEAD`
  - read and compare random file contents.
- Optional:
  - `git -C <dir> fsck --full`
  - compare selected outputs against `git clone`.

## Validation Plan

- Maintain a markdown checklist in this PRD for final sign-off.
- Capture at least one failure-case run and one successful run.

## Risks / Open Questions

- Network flakiness may cause nondeterministic failures; retries/backoff may be needed in implementation but not in this PRD.
