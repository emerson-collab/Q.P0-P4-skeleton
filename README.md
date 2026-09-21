# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side material preserves exact Contract refs and hashes without copying Contract authority bytes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0143`
- Capability Contract: `Q.SS.STD.META.CONTRACT.CAPABILITY_CONTRACT@V0117`
- Capability Package: `Q.SS.STD.META.CONTRACT.CAPABILITY_PACKAGE@V0115`
- P0 Runtime Core: `Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134`
- P1 Business Runtime: `Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0182`
- P2 Cross-Domain Realization: `Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0124`
- P3 Evolution: `Q.SS.STD.P3.CONTRACT.EVOLUTION@V0145`
- P4 Coordination: `Q.SS.STD.P4.CONTRACT.COORDINATION@V0141`

## P1 fixed framework

P1 concrete Capability implementations remain overlays over the fixed P1 Business Runtime files. P1 V0182 keeps CALL, HOOK, EVENT and REGISTRY catalogs unchanged and owns the native EVENT framework registry, exact Interface-to-existing-Operation binding, and the fixed `publish_business_event` / `consume_business_event` dispatch.

Every concrete EVENT Interface must be preverified against its exact Capability Contract and existing Operation before dispatch. Transport, caller, channel, source-code discovery and payload content cannot select or override the business Operation. `EVENT_CONSUME` forwards the event input without semantic transformation to the exact existing Operation selected only by the registered Interface binding. `EVENT_PUBLISH` delivers only after the owning Operation has produced its authoritative fact/finalized outcome and never re-executes that Operation.

## Listener-neutral runtime root

Repository Skeleton V0143 owns only the generic repository/runtime-root topology and predeclared path boundaries. It owns no listener semantics, persistent listener connection, reconnect loop, provider/channel lifecycle or listener bootstrap. P1 V0182 also owns none of those lifecycle semantics.

Persistent listener transport lifecycle may exist only when an exact Capability Contract explicitly declares that ownership. Such Capability-owned lifecycle remains inside the sole existing P0 Runtime. A second Runtime, P0 EVENT Surface expansion, runtime adapter, bridge, wrapper, listener wrapper Operation, business-specific event wrapper, polling substitute, or transport-selected Operation is forbidden.

The canonical Skeleton therefore contains no `runtime/p1_event_transport_runtime.ts` or `runtime/p1_capability_dynamic_variable_binding.ts` leaf and no matching repository-support tests. Capability-specific runtime-support leaves, when explicitly authorized, are projected only from that exact Capability Contract and DRT under the existing generic `runtime/` root.

## P2 and verification boundaries

Capability Package V0115 preserves immutable implementation-material semantics. P2 V0124 owns cross-Domain Provider/Consumer realization and receiving-owner-local durable mount/dependency runtime facts; P1 and the repository Skeleton do not acquire P2 business semantics.

Q.Workflow remains the verification/workflow execution owner. Q.Gate remains the final Gate verdict authority. Workflow success, repository merge, standard registration, or activation state is not a substitute for Gate PASS.


## Foundation P2 composition

The Skeleton includes `runtime/p2_consumer_foundation_realization.ts` as a generic
receiving-owner bootstrap primitive. It mounts a caller-supplied governed Provider
set into one P2 V0125 ACTIVE mount set, then realizes only caller-supplied,
already-declared receiving-P1 dependencies after activation.

A Q.Workflow + Q.Gate foundation is therefore composed by supplying the governed
Q.Workflow and Q.Gate Provider publications plus the Q.Workflow-declared
`Q.WORKFLOW.DEPENDENCY.Q_GATE` binding to this primitive. The Skeleton does not
copy or mirror either concrete P1 Capability implementation. Provider code remains
owned and published from its own Capability repository, while mount records,
mount-set hashes, active pointers, and dependency-realization bindings remain
receiving-owner-local runtime facts.

This support is orchestration only. It does not create Provider selection authority,
new P1 dependency semantics, a second Runtime, a direct Q.Gate bridge, or tracked
runtime mount hashes in repository source material.


## Dynamic declared-dependency realization

The Skeleton also includes `runtime/p2_consumer_dynamic_dependency_realization.ts`
for the second realization pattern: an already-declared receiving-P1 dependency
may dynamically bind to an already ACTIVE Provider mount without creating another
mount or switching the active mount-set pointer.

Runtime input supplies the receiving Domain identity, the exact Provider Capability
Contract ref, and the exact predeclared receiving-P1 owner Capability / Operation /
local dependency identities. The helper recovers and reverifies the current ACTIVE
mount set, selects exactly one matching Provider member, then reuses the existing
P2 V0125 `realize_dependency` and `bind_operation_use` path with durable exact
read-back.

For Q.Gate this allows any concrete Capability that already declares a governed
Q.Gate dependency to reuse the same ACTIVE Q.Gate mount used by Q.Workflow.
Dynamic variables instantiate exact identities only; they do not create the P1
dependency, infer Provider semantics, remount Q.Gate, or copy Q.Gate P1 code into
the Skeleton.
