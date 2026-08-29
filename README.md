# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are not stored in this implementation repository. They are resolved from Q Cloud Storage. Repository-side bindings preserve the exact Contract ref and content hash required by the applicable Q standards.

DESC and DRT projections may remain in the repository when they are part of the owning Stage physical projection. They are projections only and are not Contract authority.

The reusable skeleton does not carry a standalone product/vendor Domain authority root. Concrete Domain and Capability Contract authority remains external to the implementation repository.

## Current repository and five-stage baseline

The current Repository Directory Skeleton selection is `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0117`.

The current Stage projections are:

- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0175`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0115`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

Generated-code roots are:

- P0: `spec/p0`, `src/p0`, `tests/p0`
- P1 framework: `spec/p1/business_runtime`, `src/p1/business_runtime`
- P1 concrete Capability: `spec/p1/<capability_id>`, `src/p1/<capability_id>/<operation_id>/handler.ts`, `tests/p1/<capability_id>/<operation_id>/handler.test.ts`
- P2 Provider: `spec/p2/provider`, `src/p2/provider`, `tests/p2/provider`
- P2 Consumer: `spec/p2/consumer`, `src/p2/consumer`, `tests/p2/consumer`
- P3: `spec/p3/governed_evolution`, `src/p3/governed_evolution`, `tests/p3/governed_evolution`
- P4: `spec/p4/governed_coordination`, `src/p4/governed_coordination`, `tests/p4/governed_coordination`

Repository Skeleton V0117 closes the governed Q.Workflow repository-event trigger binding with one repository-level launcher:

- `.github/workflows/q-workflow-system-interface.yml`

The launcher is repository deployment support only. It contains no Q.Workflow transport implementation and delegates trigger handling to the Q.Workflow-owned reusable workflow entry. Per-repository `runtime/github_transport.ts`, System Interface URL, and System Interface token configuration are not part of this trigger binding.

## P1 overlay boundary

The fixed `business_runtime` framework is the reusable P1 skeleton. Concrete P1 Capability implementations are add-only overlays and remain separate from the fixed framework. No Module layer is introduced between Capability and Operation, and each concrete Operation is projected directly to `<operation_id>/handler.ts`.

Stage-local verification workflow launchers remain forbidden. Verification execution remains owned by Q.Workflow, and Q.Gate remains the final verdict authority.
