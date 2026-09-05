# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are not stored in this implementation repository. They are resolved from Q Cloud Storage. Repository-side bindings preserve the exact Contract ref and content hash required by the applicable Q standards.

DESC and DRT projections may remain in the repository when they are part of the owning Stage physical projection. They are projections only and are not Contract authority.

The reusable skeleton does not carry a standalone product/vendor Domain authority root. Concrete Domain and Capability Contract authority remains external to the implementation repository.

## Current repository and five-stage baseline

The current Repository Directory Skeleton selection is `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0123`.

The current Stage projections are:

- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0175`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0118`
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

P2 V0118 preserves the fixed Provider/Consumer topology, five Capabilities, fifteen Operations, and 52 projected repository leaves. It closes executable implementation-material resolution through an immutable Provider publication binding, P2.Consumer-owned verified `resolver_state`, and exact `implementation_binding_hash`, with mounted execution delegated only to the receiving repository local P0 runtime.

Repository Skeleton V0123 freezes P2 to the exact V0118 Contract/DRT binding and adds two non-Stage reusable repository support closures without changing P0-P4 business semantics:

- `npm test` is the single full-repository Node test entrypoint and is not a P0-only alias.
- `tools/implementation_material/materialize_capability_package.ts` materializes the CURRENT Capability Package installable material representation, performs governed durable-write plus exact read-back verification, and returns the exact immutable P2 `implementation_material_binding`.

The implementation-material support leaf follows `Q.SS.STD.META.CONTRACT.CAPABILITY_PACKAGE@V0112` and the CURRENT Database Persistence external-artifact commit protocol. It does not select providers or dependencies, infer business semantics, introduce a second runtime, use a mutable repository path as executable identity, or transfer P1 Capability ownership to P2.

Repository Skeleton V0123 preserves the repository-native Q.Workflow trigger boundary:

- provider binding: GitHub App Checks
- provider event: `check_suite.requested`
- required provider permission: Checks write
- repository source-read permission: Contents read
- execution owner: `Q.WORKFLOW.CONTRACT.DOMAIN@${CURRENT}#/system_interface_declarations/workflow_execution_invoke`

The target repository therefore does not carry `.github/workflows/q-workflow-system-interface.yml`, a copied `runtime/github_transport.ts`, or a repository-local verification Actions runner for this binding. Q.Workflow retains verification execution ownership and Q.Gate remains the final verdict authority.

## P1 overlay boundary

The fixed `business_runtime` framework is the reusable P1 skeleton. Concrete P1 Capability implementations are add-only overlays and remain separate from the fixed framework. No Module layer is introduced between Capability and Operation, and each concrete Operation is projected directly to `<operation_id>/handler.ts`.

Stage-local verification workflow launchers remain forbidden. Verification execution remains owned by Q.Workflow, and Q.Gate remains the final verdict authority.
