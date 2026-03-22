# PRD 01: HTTP Smart Protocol Foundation

## Objective
Implement the network foundation for `clone` using Git Smart HTTP discovery (`info/refs?service=git-upload-pack`).

## Scope / Out of Scope
- In scope: URL normalization, discovery request, response retrieval, protocol content-type checks.
- Out of scope: pkt-line decoding details, upload-pack negotiation, pack parsing.

## Inputs / Outputs
- Input: `remoteUrl` (e.g. `https://github.com/owner/repo`).
- Output: raw discovery response bytes plus response metadata (status, content-type).

## Dependencies
- None (first blocker).

## Acceptance Criteria
- Performs `GET <remoteUrl>/info/refs?service=git-upload-pack`.
- Rejects non-2xx responses with actionable error.
- Returns response bytes unchanged for downstream pkt-line parser.

## Implementation Notes
- Add `clone` command surface in [`app/adapters/cli-input-adapter.ts`](app/adapters/cli-input-adapter.ts) and orchestration stub in [`app/application/services/git.ts`](app/application/services/git.ts).
- Add HTTP boundary (port + adapter) for GET/POST.
- Keep transport concerns outside domain parsing.

## Validation Plan
- Manual request test against a public GitHub repo.
- Verify returned payload begins with pkt-line service prelude when decoded downstream.

## Risks / Open Questions
- Redirect handling (GitHub may redirect).
- User-agent/header requirements across hosts.
