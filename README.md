# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side bindings preserve exact Contract refs and hashes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0142`
- Capability Contract: `Q.SS.STD.META.CONTRACT.CAPABILITY_CONTRACT@V0115`
- Capability Package: `Q.SS.STD.META.CONTRACT.CAPABILITY_PACKAGE@V0115`
- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0181`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0124`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

P1 concrete Capability implementations remain add-only overlays over the fixed P1 Business Runtime skeleton. P1 V0181 EVENT execution resolves exact concrete EVENT Interface bindings before dispatch; EVENT_CONSUME invokes only the existing bound Operation, while EVENT_PUBLISH transport delivery occurs only after the owning Operation has produced its authoritative fact/finalized outcome. `PUBLICATION_ELIGIBLE` extraction is an exact derived projection of the Capability Contract External Provider Surface; P1, code scanning, AI, Capability Package, and P2 may not expand that public boundary.

Capability Package V0115 preserves QCPIM1 immutable implementation-material semantics without a Database Persistence Meta commit authority. P2 Provider publication is complete only after durable exact publication readback.

P2 mounted execution delegates only to the receiving repository local P0 runtime. Under P2 V0124, retained mounts, immutable mount sets, active mount-set pointer state, dependency-realization bindings, and execution receipts are receiving-owner-local durable runtime facts; activation mutates the active pointer last within the mount lifecycle and restart recovery is pointer-first with implementation-material and dependency-binding reverification. P2 owns lifecycle invariants and no Stage-level database objects.

Repository Skeleton V0142 preserves the receiving-P1 Consumer chain after active mount-set establishment and adds P1 EVENT transport lifecycle support only inside the existing non-stage `runtime/` support root. EVENT dispatch must resolve one exact verified concrete Interface-to-existing-Operation binding; transport or caller input cannot select the business Operation. Persistent connection/reconnect is allowed for an owner-declared transport binding, while EVENT-specific/listener directories, polling/cron substitutes, P0 EVENT Interfaces, and a second Runtime remain forbidden.

P1 Capability runtime connection uses Repository Skeleton V0142 dynamic-variable binding: exact Capability code projections expose only Contract GENERAL facts together with exact Contract ref/hash lineage, and the Skeleton fills predeclared runtime tokens before registering the exact EVENT Interface-to-existing-Operation binding. EVENT_PUBLISH and EVENT_CONSUME accept only the P1 V0181 framework methods `publish_business_event` and `consume_business_event`; EVENT_CONSUME dispatches directly to the exact existing bound Operation. No Capability-owned EVENT adapter, bridge, listener Operation, wrapper Operation, or business-specific listener/runtime implementation is part of the P1 Capability code path. Capability Instance material is not required for GENERAL EVENT identity binding, and missing/duplicate/ambiguous variables fail closed.

The Skeleton owns the reusable EVENT runtime bootstrap and persistent transport lifecycle under `runtime/`. A concrete P1 Capability supplies its exact `capability_runtime_variables` projection plus its existing Operation implementation; the already-owner-declared non-semantic repository transport connector is runtime/deployment material and cannot select or transform the business Operation.

Q.Workflow verification remains owned by the CURRENT System Interface and Q.Gate remains verdict authority.
