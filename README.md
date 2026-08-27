# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage skeleton extracted from governed Q materializations.

## Extraction boundary

The skeleton retains the P1 parent / Domain-level contract authority that already existed in the source repository under `standards/authority/domain/q_template`.

Concrete P1 Capability child overlays are intentionally removed. Future Capability materialization must use the governed P1 overlay shape:

- `spec/p1/<capability_id>/...`
- `src/p1/<capability_id>/<operation_id>/handler.ts`
- `tests/p1/<capability_id>/<operation_id>/handler.test.ts`
- `standards/authority/stages/p1/capabilities/<capability_id>/contract/...`

No Module layer is introduced between Capability and Operation.

## P1 parent and fixed-framework boundary

The P1 parent / Domain authority is part of the reusable skeleton and is retained from governed source bytes. It is not regenerated or reinterpreted in this extraction.

The active `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0174` defines the fixed `business_runtime` framework under `spec/p1/business_runtime` and `src/p1/business_runtime`. The ten fixed framework files required by that projection are materialized in this repository from the governed `Q.Prompt` P1 business-runtime materialization.

Concrete P1 Capability contracts, specs, operation handlers, and tests remain outside the fixed framework and are intentionally absent until separately governed materialization.

## Preserved fixed assets

- P0 runtime core
- P1 parent / Domain contract authority
- P1 fixed `business_runtime` framework
- P2 Provider / Consumer cross-domain realization
- P3 governed evolution
- P4 governed coordination
- shared root TypeScript toolchain files
- Stage-owned specification and verification assets already present in the extracted fixed Stage projections

Stage-local verification workflow launchers are not introduced here. Verification execution remains external to the Stage code, and repository verdict authority remains outside this skeleton.
