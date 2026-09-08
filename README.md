# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side bindings preserve exact Contract refs and hashes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0128`
- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0177`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0119`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

P1 concrete Capability implementations remain add-only overlays. The fixed P1 framework provides deterministic persistence machinery under `src/p1/business_runtime`:

- `persistence_schema_compiler.ts`: exact Capability semantics + exact instance persistence binding -> Capability-local physical schema material under `DATABASE_PERSISTENCE@V0113`.
- `persistence_schema_apply.ts`: verifies `database_instance_ref` and dialect before any DB observation/DDL, executes only artifact-bound DDL, verifies the catalog, and commits immutable migration receipt material.
- `persistence_activation_coordinator.ts`: governed automatic trigger at Capability overlay/instance activation. Persistent Capability invocation eligibility requires an `APPLIED` receipt. Process startup, Business Operation invocation, polling, and AI are not persistence triggers.

The compiler works one Capability at a time and does not merge semantics across Capabilities. Business Operations never own schema DDL. Static StageExtension publication state remains separate from receiving-instance persistence activation.

P2 mounted execution continues to delegate only to the receiving repository local P0 runtime. Q.Workflow verification remains owned by the CURRENT System Interface and Q.Gate remains verdict authority.
