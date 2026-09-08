# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are not stored in this implementation repository. They are resolved from Q Cloud Storage. Repository-side bindings preserve the exact Contract ref and content hash required by the applicable Q standards.

DESC and DRT projections may remain in the repository when they are part of the owning Stage physical projection. They are projections only and are not Contract authority.

The repository stable name is a non-semantic static scope identity. It does not create or imply a Domain Contract or a Domain business object. Concrete Capability Contract authority remains external to the implementation repository.

## Current repository and five-stage baseline

The current Repository Directory Skeleton selection is `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0127`.

The current Stage projections are:

- P0: `Q.SS.STD.P0.DRT.RUNTIME_CORE@V0134`
- P1: `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0176`
- P2: `Q.SS.STD.P2.DRT.CROSS_DOMAIN_REALIZATION@V0119`
- P3: `Q.SS.STD.P3.DRT.EVOLUTION@V0145`
- P4: `Q.SS.STD.P4.DRT.COORDINATION@V0141`

Generated-code roots are:

- P0: `spec/p0`, `src/p0`, `tests/p0`
- P1 framework: `spec/p1/business_runtime`, `src/p1/business_runtime`, `tests/p1/business_runtime`
- P1 concrete Capability: `spec/p1/<capability_id>`, `src/p1/<capability_id>/<operation_id>/handler.ts`, `tests/p1/<capability_id>/<operation_id>/handler.test.ts`
- P2 Provider: `spec/p2/provider`, `src/p2/provider`, `tests/p2/provider`
- P2 Consumer: `spec/p2/consumer`, `src/p2/consumer`, `tests/p2/consumer`
- P3: `spec/p3/governed_evolution`, `src/p3/governed_evolution`, `tests/p3/governed_evolution`
- P4: `spec/p4/governed_coordination`, `src/p4/governed_coordination`, `tests/p4/governed_coordination`

P2 V0119 preserves the fixed Provider/Consumer topology and executable implementation-material resolution through an immutable Provider publication binding, P2.Consumer-owned verified `resolver_state`, and exact `implementation_binding_hash`, with mounted execution delegated only to the receiving repository local P0 runtime. V0119 also closes durable owner-local mount retention, atomic-last active-pointer commit, and restart recovery as normative P2 behavior.

Repository Skeleton V0127 preserves the repository support closures and binds the P1 framework leaf authority to `Q.SS.STD.P1.DRT.BUSINESS_RUNTIME@V0176` without changing concrete Capability/Operation ownership or paths.

P1 V0176 adds two fixed framework leaves under `src/p1/business_runtime` and matching framework tests:

- `persistence_schema_compiler.ts` deterministically compiles one exact Capability semantic source plus one exact instance persistence binding into Capability-local physical schema material under `Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0111`.
- `persistence_schema_apply.ts` verifies that material, executes only its exact ordered DDL through the injected relational transaction boundary, verifies the resulting catalog, and persists immutable migration receipt material before the receipt index is committed.

The persistence closure does not infer schema from handlers, tests, live database state, provider defaults, or AI. It compiles one Capability at a time, does not merge business semantics across Capabilities, and Business Operation invocation never owns schema DDL.

The implementation-material support leaf `tools/implementation_material/materialize_capability_package.ts` remains governed by the CURRENT Capability Package and Database Persistence authorities. It does not select providers or dependencies, infer business semantics, introduce a second runtime, use a mutable repository path as executable identity, or transfer P1 Capability ownership to P2.

The repository-native Q.Workflow trigger boundary is:

- provider binding: GitHub App Checks
- provider event: `check_suite.requested`
- required provider permission: Checks write
- repository source-read permission: Contents read
- execution owner: `Q.WORKFLOW.CONTRACT.SYSTEM_INTERFACE.WORKFLOW_EXECUTION_INVOKE@${CURRENT}`

The target repository therefore does not carry a repository-local Q.Workflow/Q.Gate connection implementation. Q.Workflow retains verification execution ownership and Q.Gate remains the final verdict authority.

## P1 overlay boundary

The fixed `business_runtime` framework is the reusable P1 skeleton. Concrete P1 Capability implementations are add-only overlays and remain separate from the fixed framework. No Module layer is introduced between Capability and Operation, and each concrete Operation is projected directly to `<operation_id>/handler.ts`.

The Persistence Schema Compiler and Schema Apply Executor are framework machinery only. They do not own business semantics; exact Capability Contracts remain the semantic authority and remain independently extractable/rematerializable.

Stage-local verification workflow launchers remain forbidden. Verification execution remains owned by Q.Workflow, and Q.Gate remains the final verdict authority.
