# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side bindings preserve exact Contract refs and hashes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0129`
- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0178`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0120`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

P1 concrete Capability implementations remain add-only overlays over the fixed P1 Business Runtime skeleton. Database Persistence Meta Standard materializer/compiler/apply/activation projections are not part of this repository baseline.

P2 mounted execution delegates only to the receiving repository local P0 runtime. Under P2 V0120, durable mount, mount-set and active mount-set pointer state is receiving-Domain owner-local Skeleton/runtime state; P2 owns lifecycle invariants and no Stage-level database objects.

Q.Workflow verification remains owned by the CURRENT System Interface and Q.Gate remains verdict authority.
