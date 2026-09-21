import assert from "node:assert/strict";
import test from "node:test";

import {
  realizeP2Foundation,
} from "../../../runtime/p2_consumer_foundation_realization.ts";
import type {
  JsonObject,
} from "../../../runtime/p2_consumer_foundation_realization.ts";
import type {
  P2ConsumerRealizationPersistence,
} from "../../../runtime/p2_consumer_p1_dependency_realization.ts";

function inMemoryPersistence(): Readonly<{
  persistence: P2ConsumerRealizationPersistence;
  activePointer(): JsonObject | undefined;
  dependencyCount(): number;
}> {
  const mounts = new Map<string, JsonObject>();
  const mountSets = new Map<string, JsonObject>();
  const dependencies = new Map<string, JsonObject>();
  let pointer: JsonObject | undefined;

  const key = (
    domain: string,
    owner: string,
    operation: string,
    dependency: string,
    active: string,
  ) => [domain, owner, operation, dependency, active].join("\u0000");

  const persistence: P2ConsumerRealizationPersistence = Object.freeze({
    async persist_mount_record({ receiving_domain_ref, mount_hash, mount }) {
      mounts.set(`${receiving_domain_ref}\u0000${mount_hash}`, mount);
    },
    async read_mount_record({ receiving_domain_ref, mount_hash }) {
      return mounts.get(`${receiving_domain_ref}\u0000${mount_hash}`);
    },
    async persist_mount_set_record({
      receiving_domain_ref,
      mount_set_hash,
      mount_set,
    }) {
      mountSets.set(`${receiving_domain_ref}\u0000${mount_set_hash}`, mount_set);
    },
    async read_mount_set_record({ receiving_domain_ref, mount_set_hash }) {
      return mountSets.get(`${receiving_domain_ref}\u0000${mount_set_hash}`);
    },
    async reverify_implementation_material() {
      return;
    },
    async read_active_mount_set_pointer({ receiving_domain_ref }) {
      return pointer?.receiving_domain_ref === receiving_domain_ref
        ? pointer
        : undefined;
    },
    async switch_active_mount_set_pointer({
      receiving_domain_ref,
      mount_set_hash,
    }) {
      pointer = Object.freeze({
        receiving_domain_ref,
        mount_set_hash,
        status: "ACTIVE",
      });
    },
    async persist_dependency_binding_record(input) {
      dependencies.set(
        key(
          input.receiving_domain_ref,
          input.exact_owner_capability_ref,
          input.exact_receiving_operation_ref,
          input.exact_local_dependency_ref,
          input.active_mount_set_hash,
        ),
        structuredClone(input.binding) as JsonObject,
      );
    },
    async read_dependency_binding_record(input) {
      return dependencies.get(
        key(
          input.receiving_domain_ref,
          input.exact_owner_capability_ref,
          input.exact_receiving_operation_ref,
          input.exact_local_dependency_ref,
          input.active_mount_set_hash,
        ),
      );
    },
  });

  return Object.freeze({
    persistence,
    activePointer: () => pointer,
    dependencyCount: () => dependencies.size,
  });
}

function publication(
  contractRef: string,
  interfaceRef: string,
  seed: string,
  entry: string,
): JsonObject {
  return Object.freeze({
    immutable: true,
    capability_contract_ref: contractRef,
    capability_contract_hash: `sha256:${seed.repeat(64)}`,
    provider_interface_refs: Object.freeze([interfaceRef]),
    publication_hash: `sha256:${seed.toUpperCase().toLowerCase().repeat(64)}`,
    publication_artifact_binding: Object.freeze({
      immutable: true,
      artifact_ref: `Q.CAPABILITY_PACKAGE.TEST.${seed}@V0100#/implementation_material`,
      content_hash: `sha256:${seed.repeat(64)}`,
      entry_symbol_ref: entry,
      provider_neutral_locator_binding: Object.freeze({ kind: "test" }),
    }),
  });
}

test("foundation realization mounts Workflow and Gate together then realizes Workflow q_gate dependency", async () => {
  const store = inMemoryPersistence();
  const receivingDomainRef = "Q.BUSINESS.CONTRACT.DOMAIN.EXAMPLE@V0100";

  const workflowContractRef =
    "Q.WORKFLOW.CONTRACT.CAPABILITY.WORKFLOW@V0130";
  const workflowPublication = publication(
    workflowContractRef,
    `${workflowContractRef}#/interfaces/workflow_execution_invoke`,
    "a",
    "src/p1/export/workflow/entry.ts#entry",
  );

  const gateContractRef =
    "Q.SS.STD.P1.CONTRACT.GATE_CAPABILITY@V0165";
  const gatePublication = publication(
    gateContractRef,
    `${gateContractRef}#/interfaces/gate_execution_invoke`,
    "b",
    "src/p1/export/gate/entry.ts#entry",
  );

  const result = await realizeP2Foundation(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    providers: Object.freeze([
      Object.freeze({
        publication: workflowPublication,
        verification: Object.freeze({
          integrity_verified: true,
          local_material_binding_ref: "local:workflow",
        }),
      }),
      Object.freeze({
        publication: gatePublication,
        verification: Object.freeze({
          integrity_verified: true,
          local_material_binding_ref: "local:gate",
        }),
      }),
    ]),
    declared_dependencies: Object.freeze([
      Object.freeze({
        provider_capability_contract_ref: gateContractRef,
        receiving_p1_binding: Object.freeze({
          exact_owner_capability_ref:
            "Q.WORKFLOW.CAPABILITY.WORKFLOW@V0130",
          exact_receiving_operation_ref:
            "Q.WORKFLOW.CONTRACT.CAPABILITY.WORKFLOW@V0130#/operations/execute_workflow",
          exact_local_dependency_ref:
            "Q.WORKFLOW.DEPENDENCY.Q_GATE@V0100",
        }),
      }),
    ]),
    trace_id: "trace-foundation",
    request_id: "request-foundation",
  }), store.persistence);

  assert.equal(result.active_mount_set.status, "ACTIVE");
  assert.equal(result.mounts.length, 2);
  assert.equal(result.dependency_results.length, 1);
  assert.equal(store.dependencyCount(), 1);
  assert.equal(
    store.activePointer()?.mount_set_hash,
    result.active_mount_set.mount_set_hash,
  );

  const members = result.active_mount_set.members;
  assert.ok(Array.isArray(members));
  assert.deepEqual(
    members.map((member) =>
      String((member as JsonObject).provider_capability_contract_ref)
    ),
    [workflowContractRef, gateContractRef].sort(),
  );

  const dependency = result.dependency_results[0]!;
  assert.equal(
    dependency.provider_capability_contract_ref,
    gateContractRef,
  );
  assert.equal(
    dependency.dependency_realization_binding.exact_owner_capability_ref,
    "Q.WORKFLOW.CAPABILITY.WORKFLOW@V0130",
  );
  assert.equal(
    dependency.dependency_realization_binding.exact_local_dependency_ref,
    "Q.WORKFLOW.DEPENDENCY.Q_GATE@V0100",
  );
  assert.equal(
    dependency.operation_use_binding.exact_receiving_operation_ref,
    "Q.WORKFLOW.CONTRACT.CAPABILITY.WORKFLOW@V0130#/operations/execute_workflow",
  );
});

test("foundation realization does not synthesize any receiving-P1 dependency", async () => {
  const store = inMemoryPersistence();
  const contractRef = "Q.PROVIDER.CONTRACT.CAPABILITY.EXAMPLE@V0100";
  const result = await realizeP2Foundation(Object.freeze({
    receiving_domain_ref: "Q.BUSINESS.CONTRACT.DOMAIN.EXAMPLE@V0100",
    providers: Object.freeze([
      Object.freeze({
        publication: publication(
          contractRef,
          `${contractRef}#/interfaces/example_invoke`,
          "c",
          "src/p1/export/example/entry.ts#entry",
        ),
        verification: Object.freeze({
          integrity_verified: true,
          local_material_binding_ref: "local:example",
        }),
      }),
    ]),
    trace_id: "trace-foundation-no-dependency",
    request_id: "request-foundation-no-dependency",
  }), store.persistence);

  assert.equal(result.active_mount_set.status, "ACTIVE");
  assert.equal(result.dependency_results.length, 0);
  assert.equal(store.dependencyCount(), 0);
});
