# Final Stage PRDs

This folder contains a blocking-first task breakdown for implementing the final challenge stage: `clone`.

## Execution Order

1. `01-http-smart-protocol-prd.md`
2. `02-pkt-line-parser-prd.md`
3. `03-upload-pack-negotiation-prd.md`
4. `04-sideband-pack-stream-prd.md`
5. `05-packfile-parser-core-prd.md`
6. `06-delta-application-prd.md`
7. `07-object-reconstruction-write-prd.md`
8. `08-refs-and-head-materialization-prd.md`
9. `09-working-tree-checkout-prd.md`
10. `10-clone-orchestration-errors-prd.md`
11. `11-validation-matrix-prd.md`

## Dependency Graph

- `01` blocks `03`.
- `02` blocks `03` and `04`.
- `03` blocks `04`.
- `04` blocks `05`.
- `05` blocks `06`.
- `06` blocks `07`.
- `07` blocks `08` and `09`.
- `08` and `09` block `10`.
- `10` blocks `11`.

Each PRD is self-contained with objective, scope, I/O, dependencies, acceptance criteria, implementation notes, validation plan, and risks.
