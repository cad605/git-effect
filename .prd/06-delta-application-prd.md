# PRD 06: Delta Resolution and Application

## Objective
Implement `ofs-delta` and `ref-delta` handling to reconstruct full object bodies.

## Scope / Out of Scope
- In scope: base object lookup by offset/hash, delta instruction decoding, copy/insert execution, size validation.
- Out of scope: object storage and ref checkout.

## Inputs / Outputs
- Inputs:
  - parsed pack entries from PRD 05
  - already reconstructed base objects.
- Output: fully reconstructed object bodies for every entry.

## Dependencies
- Requires `05-packfile-parser-core-prd.md`.

## Acceptance Criteria
- Resolves both delta types correctly.
- Reconstructed output size matches delta-declared result size.
- Fails with clear errors on missing base or malformed opcodes.

## Implementation Notes
- Domain libs:
  - `decode-delta-varint.ts`
  - `apply-git-delta.ts`
  - `resolve-pack-deltas.ts`.
- Preserve pack entry order semantics while allowing dependency resolution.

## Validation Plan
- Unit tests with handcrafted delta examples.
- Integration against small public repos known to include deltas.

## Risks / Open Questions
- Recursive delta chains can be deep; ensure stack-safe iteration.
