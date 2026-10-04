# Q.P0-P4 Skeleton

This repository is the reusable Q five-stage implementation skeleton.

## Authority boundary

Authoritative Contract bytes are resolved from Q Cloud Storage. Repository-side material preserves exact Contract refs and hashes without copying Contract authority bytes. The repository stable name is non-semantic and does not create a Domain Contract; concrete Capability Contract authority remains external.

## Current baseline

- Repository Skeleton: `Q.SS.STD.META.CONTRACT.REPOSITORY_DIRECTORY_SKELETON@V0152`
- P1 Capability Materialization: `Q.SS.STD.META.CONTRACT.P1_CAPABILITY_MATERIALIZATION@V0111`
- Capability Contract compatibility baseline: `Q.SS.STD.META.CONTRACT.CAPABILITY_CONTRACT@V0118`
- Capability Package: `Q.SS.STD.META.CONTRACT.CAPABILITY_PACKAGE@V0115`
- P0 Runtime Core: `Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134`
- P1 Business Runtime: `Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0184`
- P2 Cross-Domain Realization: `Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0125`
- Governed Data Material: `Q.SS.STD.META.CONTRACT.GOVERNED_DATA_MATERIAL@V0104`
- P3 Evolution: `Q.SS.STD.P3.CONTRACT.EVOLUTION@V0145`
- P4 Coordination: `Q.SS.STD.P4.CONTRACT.COORDINATION@V0141`

## P0-P4 topology

Repository Skeleton V0152 preserves the exact existing five-stage selection and repository root topology. P0 remains the sole Runtime. P1 remains the fixed Business Runtime. P2 remains the cross-domain realization authority. No new Stage root, P2A/P2B stage identity, second Runtime, adapter, bridge, or wrapper authority is introduced by the V0152 governed-data closure.

## P1 fixed framework

P1 concrete Capability implementations remain direct overlays over the fixed P1 Business Runtime V0184 files. Capability GENERAL values bind only to predeclared P1 framework slots; `route_key` remains a P1-derived runtime identity. Capability-specific code cannot mutate the fixed P1 Skeleton or create a second Runtime.

## Governed-data JSON triad execution

Repository Skeleton V0152 closes the non-Stage repository-support execution boundary for the exact P1 Capability Materialization V0111 `governed_data_json_triad_obligation`.

For an exact DECLARED obligation:

```text
STATIC  → static.json  → expose_static_data
DYNAMIC → dynamic.json → expose_dynamic_data
RUNTIME → runtime.json → expose_runtime_data
```

Every declared binding is partitioned only by its exact declared `data_category`. A non-empty category executes only its existing CURRENT P2 V0125 Provider exposure Operation. An empty category still produces its canonical JSON file with `bindings: []` and `material_envelopes: []`, but invokes no P2 exposure Operation.

Each file preserves the exact Capability Contract ref/hash, frozen P2 ref/hash, exact P2 handoff obligation snapshot hash, declared binding/member lineage, and exact GDM material envelopes. Filenames are physical projection identities only and do not become semantic authority.

All three files must become durable and pass exact hash readback before triad commit. The ordered set is always:

```text
static.json
dynamic.json
runtime.json
```

The exact implementing storage or persistence authority owns the `SHA256_CANONICAL_ORDERED_FILE_HASH_TUPLE` realization and any mutable current-pointer semantics. Partial triad CURRENT state is forbidden; the current pointer switches atomically and last.

The repository Skeleton does not redefine P2 category/exposure semantics or GDM material protocol semantics, and P1 does not directly write governed material while bypassing P2.

## Verification boundary

`npm test` is the full repository Node test entrypoint. Q.Workflow remains the verification/workflow execution owner and Q.Gate remains the final Gate verdict authority. Workflow success, repository merge, standard registration, or activation state is not a substitute for Gate PASS.
