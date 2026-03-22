# PRD 05: Packfile Parser Core

## Objective
Parse packfile structure and extract non-delta objects with metadata required for reconstruction.

## Scope / Out of Scope
- In scope: `PACK` header validation, version/object-count parsing, object entry header parsing, zlib payload inflation.
- Out of scope: delta resolution logic.

## Inputs / Outputs
- Input: packfile bytes from PRD 04.
- Output: ordered pack entries:
  - offset
  - type
  - size
  - payload bytes (inflated for non-delta, encoded for delta as needed).

## Dependencies
- Requires `04-sideband-pack-stream-prd.md`.

## Acceptance Criteria
- Validates pack signature and supported version.
- Correctly decodes object type/size varints.
- Produces deterministic entry list for downstream delta resolver.

## Implementation Notes
- Domain libs:
  - `parse-pack-header.ts`
  - `parse-pack-entry.ts`
  - `parse-packfile.ts`.
- Use existing compression abstractions for zlib inflate where practical.

## Validation Plan
- Fixture-based parser tests for tiny known packfiles.
- Verify object count consistency.

## Risks / Open Questions
- Streaming vs full-buffer parse tradeoff; full-buffer is acceptable for challenge scope.
