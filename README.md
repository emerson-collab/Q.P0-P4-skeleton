# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage skeleton extracted from the original combined materialization.

## Extraction boundary

The skeleton retains the P1 parent / Domain-level contract authority that already existed in the source repository under `standards/authority/domain/q_template`.

Concrete P1 Capability child overlays are intentionally removed. Future Capability materialization must use the governed P1 overlay shape:

- `spec/p1/<capability_id>/...`
- `src/p1/<capability_id>/<operation_id>/handler.ts`
- `tests/p1/<capability_id>/<operation_id>/handler.test.ts`
- `standards/authority/stages/p1/capabilities/<capability_id>/contract/...`

No Module layer is introduced between Capability and Operation.

## P1 parent and fixed-framework boundary

The P1 parent / Domain authority is part of the reusable skeleton and is retained from the original repository bytes. It is not regenerated or reinterpreted in this extraction.

Separately, the active `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0174` defines a fixed `business_runtime` framework under `spec/p1/business_runtime` and `src/p1/business_runtime`.

Those exact fixed-framework implementation bytes were not present in the source `Q.P0-P4-skeleton` repository, and no authoritative implementation files were found in the connected Sources. They are therefore not synthesized here. Before later LLM-generated concrete P1 Capability code is accepted, the exact authoritative fixed P1 `business_runtime` framework must be materialized from a governed source.

## Preserved fixed assets

- P0 runtime core
- P1 parent / Domain contract authority
- P2 Provider / Consumer cross-domain realization
- P3 governed evolution
- P4 governed coordination
- shared root TypeScript toolchain files
- Stage-owned specification and verification assets already present in the extracted fixed Stage projections

Stage-local verification workflow launchers are not introduced here. Verification execution remains external to the Stage code, and repository verdict authority remains outside this skeleton.
