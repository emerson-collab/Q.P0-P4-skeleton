# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage skeleton extracted from the original combined materialization.

## Extraction boundary

The repository keeps the fixed Stage-owned assets that already belong to the reusable P0/P2/P3/P4 skeleton and removes Q.Template-specific Domain and concrete P1 Capability material.

P1 concrete business Capability content is intentionally absent. It is the governed fill area for later materialization from an exact P1 Capability Contract / Prompt Artifact.

The applicable repository skeleton projection requires the P1 variable business path to be:

- `spec/p1/<capability_id>/...`
- `src/p1/<capability_id>/<operation_id>/handler.ts`
- `tests/p1/<capability_id>/<operation_id>/handler.test.ts`

No Module layer is introduced between Capability and Operation.

## Preserved fixed skeleton

- P0 runtime core
- P2 Provider / Consumer cross-domain realization
- P3 governed evolution
- P4 governed coordination
- shared root TypeScript toolchain files
- Stage-owned specification and verification assets required by the extracted Stage projections

Stage-local verification workflow launchers are not introduced here. Verification execution remains external to the Stage code, and repository verdict authority remains outside this skeleton.
