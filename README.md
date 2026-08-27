# Q.P0 — Runtime Core Baseline Skeleton

This repository materializes the current P0 runtime skeleton defined by
`Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134` and its current V0134 physical projection.

P0 owns one shared local `RuntimeProvider`, one `RuntimePipeline`, one `HookAnchor`,
three local runtime interfaces (M1/M2/M3), `StageExtensionContract`, and in-memory
runtime result/error/hook evidence semantics.

P0 does **not** own business Capability or business Operation semantics, system-level
entry, cross-domain P2 realization, repository Gate verdict, Activation, persistent
database state, artifact storage, or later-stage implementation content.

Stable Stage identities are `P0`, `P1`, `P2`, `P3`, and `P4`. P2 Provider and Consumer
are role profiles inside Stage P2.

The current P0 initial template contains exactly 14 files: five shared root toolchain
files and nine P0-owned assets. The P0-owned slice is four specification files, four
source files, and one test file. No Stage-local verification workflow, no `tools/p0`
directory, and no P1-P4 placeholder directories are part of this baseline.

P0 owns its build/test/smoke verification assets, but verification execution is routed
through `Q.WORKFLOW.CONTRACT.DOMAIN@V0116#/system_interface_declarations/workflow_execution_invoke`.
Q.Workflow execution success is evidence/execution status only; final repository verdict
authority remains Q.Gate.

## Commands

```bash
npm ci
npm run build
npm run test:p0
npm run smoke:p0
```
