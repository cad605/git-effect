# PRD 04: Side-Band Stream Reassembly

## Objective

Decode side-band packets from upload-pack response and reconstruct raw packfile bytes.

## Scope / Out of Scope

- In scope: side-band channel parsing (`1` data, `2` progress, `3` fatal), concatenation of channel 1 payload.
- Out of scope: unpacking pack object records.

## Inputs / Outputs

- Input: raw upload-pack response bytes.
- Output: contiguous packfile byte stream.

## Dependencies

- Requires `02-pkt-line-parser-prd.md`.
- Requires `03-upload-pack-negotiation-prd.md`.

## Acceptance Criteria

- Correctly handles flush packets and side-band framing.
- Ignores or logs progress channel without failing.
- Fails fast on channel 3 (fatal).

## Implementation Notes

- Domain lib: `parse-sideband-response.ts`.
- Return both pack bytes and optional progress messages for debugging.

## Validation Plan

- Fixture with mixed channel packets.
- Integration check: output starts with `PACK` signature.

## Risks / Open Questions

- Repositories that respond without side-band when capability negotiation differs.
