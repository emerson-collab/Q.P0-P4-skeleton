# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side bindings preserve exact Contract refs and hashes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton candidate: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0143`
- Capability Contract candidate: `Q.SS.STD.META.CONTRACT.CAPABILITY_CONTRACT@V0117`
- Capability Package: `Q.SS.STD.META.CONTRACT.CAPABILITY_PACKAGE@V0115`
- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1 candidate: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0182`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0124`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

P1 concrete Capability implementations remain add-only overlays over the fixed P1 Business Runtime skeleton. P1 V0182 EVENT execution resolves exact concrete EVENT Interface bindings before dispatch; EVENT_CONSUME invokes only the existing bound Operation, while EVENT_PUBLISH transport delivery occurs only after the owning Operation has produced its authoritative fact/finalized outcome. `PUBLICATION_ELIGIBLE` extraction is an exact derived projection of the Capability Contract External Provider Surface; P1, code scanning, AI, Capability Package, and P2 may not expand that public boundary.

Capability Package V0115 preserves QCPIM1 immutable implementation-material semantics without a Database Persistence Meta commit authority. P2 Provider publication is complete only after durable exact publication readback.

P2 mounted execution delegates only to the receiving repository local P0 runtime. Under P2 V0124, retained mounts, immutable mount sets, active mount-set pointer state, dependency-realization bindings, and execution receipts are receiving-owner-local durable runtime facts; activation mutates the active pointer last within the mount lifecycle and restart recovery is pointer-first with implementation-material and dependency-binding reverification. P2 owns lifecycle invariants and no Stage-level database objects.

P1 V0182 EVENT execution remains part of the fixed P1 Business Runtime framework: EVENT_PUBLISH and EVENT_CONSUME resolve exact concrete Interface bindings before dispatch, and EVENT_CONSUME invokes only the existing bound Operation. Transport or caller input cannot select the business Operation.

The reusable repository Skeleton no longer carries an EVENT listener engine, listener bootstrap, reconnect loop, EVENT-specific runtime-variable binder, or other listener-specific runtime leaf. The `runtime/` root remains generic repository deployment support. Listener transport lifecycle is expected to be supplied by separately governed Capability semantics while still executing through the sole existing P0 runtime; the Skeleton itself does not define or implement listener behavior.

Q.Workflow verification remains owned by the CURRENT System Interface and Q.Gate remains verdict authority.
