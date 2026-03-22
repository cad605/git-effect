# PRD 07: Object Reconstruction, Hash Verification, and Storage

## Objective
Convert reconstructed pack entries into canonical Git objects, verify hashes, and write loose objects.

## Scope / Out of Scope
- In scope: object canonicalization (`<type> <size>\0<body>`), SHA-1 verification, object writes to `.git/objects`.
- Out of scope: branch refs/HEAD and working tree checkout.

## Inputs / Outputs
- Input: fully reconstructed objects from PRD 06.
- Output: stored loose objects and map of object hash to object metadata.

## Dependencies
- Requires `06-delta-application-prd.md`.

## Acceptance Criteria
- Hash computed from canonical bytes matches expected identity.
- Objects are zlib-compressed and written to loose object paths.
- Duplicate object writes are safely skipped or overwritten idempotently.

## Implementation Notes
- Reuse:
  - [`app/domain/lib/encode-object.ts`](app/domain/lib/encode-object.ts)
  - [`app/adapters/crypto-output-adapter.ts`](app/adapters/crypto-output-adapter.ts)
  - [`app/adapters/repository-output-adapter.ts`](app/adapters/repository-output-adapter.ts)
  - [`app/adapters/compression-output-adapter.ts`](app/adapters/compression-output-adapter.ts)

## Validation Plan
- For a cloned repo, verify written objects with `git cat-file -t <hash>`.
- Spot-check commit/tree/blob payloads for integrity.

## Risks / Open Questions
- Writing many loose objects may be slower than pack retention, but acceptable for challenge requirements.
