# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side bindings preserve exact Contract refs and hashes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0135`
- Capability Contract: `Q.SS.STD.META.CONTRACT.CAPABILITY_CONTRACT@V0106`
- Capability Package: `Q.SS.STD.META.CONTRACT.CAPABILITY_PACKAGE@V0115`
- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0179`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0122`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

P1 concrete Capability implementations remain add-only overlays over the fixed P1 Business Runtime skeleton. `PUBLICATION_ELIGIBLE` extraction is an exact derived projection of the Capability Contract External Provider Surface; P1, code scanning, AI, Capability Package, and P2 may not expand that public boundary.

Capability Package V0115 preserves QCPIM1 immutable implementation-material semantics without a Database Persistence Meta commit authority. P2 Provider publication is complete only after durable exact publication readback.

P2 mounted execution delegates only to the receiving repository local P0 runtime. Under P2 V0122, retained mounts, immutable mount sets, active mount-set pointer state, and execution receipts are receiving-owner-local durable runtime facts; activation mutates the active pointer last within the mount lifecycle and restart recovery is pointer-first with implementation-material reverification. P2 owns lifecycle invariants and no Stage-level database objects.

Repository Skeleton V0135 closes the receiving-P1 Consumer chain after active mount-set establishment: the receiving Capability must already declare `exact_owner_capability_ref`, `exact_receiving_operation_ref`, and `exact_local_dependency_ref`; repository runtime support then executes the existing P2 V0122 `realize_dependency` followed by `bind_operation_use`. P2 does not create the receiving dependency, redefine its business semantics, or create another Runtime.

Q.Workflow verification remains owned by the CURRENT System Interface and Q.Gate remains verdict authority.
