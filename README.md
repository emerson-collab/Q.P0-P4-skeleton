# Q.P0-P4 Skeleton

This repository is the cleaned reusable Stage extraction from the original combined materialization.

## Extraction boundary

The repository preserves the fixed Stage-owned assets already present for P0, P2, P3, and P4, and removes Q.Template-specific Domain material and every concrete P1 Capability overlay that was present in the source repository.

Concrete P1 business Capability content is intentionally absent. Future concrete Capability materialization must use the governed P1 overlay shape:

- `spec/p1/<capability_id>/...`
- `src/p1/<capability_id>/<operation_id>/handler.ts`
- `tests/p1/<capability_id>/<operation_id>/handler.test.ts`

No Module layer is introduced between Capability and Operation.

## P1 fixed-framework boundary

The active `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0174` separately defines a fixed `business_runtime` framework under `spec/p1/business_runtime` and `src/p1/business_runtime`.

Those exact fixed-framework implementation bytes were not present in the source `Q.P0-P4-skeleton` repository, and no authoritative implementation files were found in the connected Sources. They are therefore not synthesized here. The repository remains fail-closed for that missing fixed P1 framework rather than importing Domain-specific legacy code or inventing placeholder semantics.

Before later LLM-generated concrete P1 Capability code is accepted, the exact authoritative fixed P1 `business_runtime` framework must be materialized into this repository from a governed source.

## Preserved fixed assets

- P0 runtime core
- P2 Provider / Consumer cross-domain realization
- P3 governed evolution
- P4 governed coordination
- shared root TypeScript toolchain files
- Stage-owned specification and verification assets already present in the extracted Stage projections

Stage-local verification workflow launchers are not introduced here. Verification execution remains external to the Stage code, and repository verdict authority remains outside this skeleton.
