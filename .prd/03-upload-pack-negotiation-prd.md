# PRD 03: Upload-Pack Negotiation

## Objective

Create the upload-pack request payload (`want`/`done`) and fetch pack response bytes via POST.

## Scope / Out of Scope

- In scope: capability selection, want line construction, done/flush framing.
- Out of scope: side-band decoding and pack parsing.

## Inputs / Outputs

- Inputs:
  - target commit hash
  - server capabilities
  - remote URL.
- Output: raw upload-pack response bytes.

## Dependencies

- Requires `01-http-smart-protocol-prd.md`.
- Requires `02-pkt-line-parser-prd.md`.

## Acceptance Criteria

- Sends POST to `<remoteUrl>/git-upload-pack`.
- Payload includes correctly framed pkt-lines.
- Uses compatible capability subset (`side-band-64k`, `ofs-delta`, optional `no-progress`).

## Implementation Notes

- Domain helper for `build-upload-pack-request`.
- HTTP adapter reused from PRD 01 for POST.
- Service orchestration in [`app/application/services/git.ts`](app/application/services/git.ts).

## Validation Plan

- Integration against public repo: verify non-empty response.
- Validate first channel data is parseable by PRD 04.

## Risks / Open Questions

- Capability mismatch fallback strategy when server omits desired features.
