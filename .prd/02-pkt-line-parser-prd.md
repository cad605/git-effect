# PRD 02: Pkt-Line Utilities and Advertisement Parsing

## Objective
Implement pkt-line encode/decode utilities and parse advertised refs/capabilities from discovery response.

## Scope / Out of Scope
- In scope: pkt-line length parsing, flush packet handling, ref line parsing, capability extraction.
- Out of scope: `want` negotiation and upload-pack POST body assembly.

## Inputs / Outputs
- Input: discovery response bytes from PRD 01.
- Output:
  - ordered advertised refs
  - capability set
  - resolved HEAD symref target (if advertised)

## Dependencies
- Requires `01-http-smart-protocol-prd.md`.

## Acceptance Criteria
- Correctly parses `# service=git-upload-pack` prelude and flush packets.
- Extracts first-ref capabilities and subsequent refs.
- Resolves a target branch candidate from symref/heads.

## Implementation Notes
- Domain library files under `app/domain/lib/`:
  - `decode-pkt-line.ts`
  - `encode-pkt-line.ts`
  - `parse-ref-advertisement.ts`
- Keep parsing pure and side-effect free.

## Validation Plan
- Unit fixtures for:
  - valid advertisement
  - malformed length
  - unexpected EOF.
- Verify output model includes refs and capabilities needed by PRD 03.

## Risks / Open Questions
- Host-specific capability ordering differences.
