import assert from "node:assert/strict";
import test from "node:test";

import {
  realizeP2Foundation,
} from "../../../runtime/p2_consumer_foundation_realization.ts";
import {
  realizeP2DynamicDeclaredDependency,
} from "../../../runtime/p2_consumer_dynamic_dependency_realization.ts";
import type {
  JsonObject,
} from "../../../runtime/p2_consumer_mount_realization.ts";
import type {
  P2ConsumerRealizationPersistence,
} from "../../../runtime/p2_consumer_p1_dependency_realization.ts";

function inMemoryPersistence(): Readonly<{
  persistence: P2ConsumerRealizationPersistence;
  activePointer(): JsonObject | undefined;
  mountCount(): number;
  dependencyCount(): number;
}> {
  const mounts = new Map<string, JsonObject>();
  const mountSets = new Map<string, JsonObject>();
  const dependencies = new Map<string, JsonObject>();
  let pointer: JsonObject | undefined;

  const dependencyKey = (
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
      mountSets.set(
        `${receiving_domain_ref}\u0000${mount_set_hash}`,
        mount_set,
      );
    },
    async read_mount_set_record({ receiving_domain_ref, mount_set_hash }) {
      return mountSets.get(
        `${receiving_domain_ref}\u0000${mount_set_hash}`,
      );
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
        dependencyKey(
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
        dependencyKey(
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
    mountCount: () => mounts.size,
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
    publication_hash: `sha256:${seed.repeat(64)}`,
    publication_artifact_binding: Object.freeze({
      immutable: true,
      artifact_ref:
        `Q.CAPABILITY_PACKAGE.TEST.${seed}@V0100#/implementation_material`,
      content_hash: `sha256:${seed.repeat(64)}`,
      entry_symbol_ref: entry,
      provider_neutral_locator_binding: Object.freeze({ kind: "test" }),
    }),
  });
}

const receivingDomainRef = "Q.BUSINESS.CONTRACT.DOMAIN.EXAMPLE@V0100";
const workflowContractRef =
  "Q.WORKFLOW.CONTRACT.CAPABILITY.WORKFLOW@V0130";
const gateContractRef =
  "Q.SS.STD.P1.CONTRACT.GATE_CAPABILITY@V0165";

async function mountFoundation(
  store: ReturnType<typeof inMemoryPersistence>,
) {
  return await realizeP2Foundation(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    providers: Object.freeze([
      Object.freeze({
        publication: publication(
          workflowContractRef,
          `${workflowContractRef}#/interfaces/workflow_execution_invoke`,
          "a",
          "src/p1/export/workflow/entry.ts#entry",
        ),
        verification: Object.freeze({
          integrity_verified: true,
          local_material_binding_ref: "local:workflow",
        }),
      }),
      Object.freeze({
        publication: publication(
          gateContractRef,
          `${gateContractRef}#/interfaces/gate_execution_invoke`,
          "b",
          "src/p1/export/gate/entry.ts#entry",
        ),
        verification: Object.freeze({
          integrity_verified: true,
          local_material_binding_ref: "local:gate",
        }),
      }),
    ]),
    trace_id: "trace-foundation",
    request_id: "request-foundation",
  }), store.persistence);
}

test("dynamic business dependency reuses the existing ACTIVE Q.Gate mount without remounting or pointer mutation", async () => {
  const store = inMemoryPersistence();
  const foundation = await mountFoundation(store);
  const activeHash = String(foundation.active_mount_set.mount_set_hash);
  assert.equal(store.mountCount(), 2);
  assert.equal(store.dependencyCount(), 0);

  const result = await realizeP2DynamicDeclaredDependency(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    provider_capability_contract_ref: gateContractRef,
    receiving_p1_binding: Object.freeze({
      exact_owner_capability_ref:
        "Q.BUSINESS.CAPABILITY.APPROVAL@V0100",
      exact_receiving_operation_ref:
        "Q.BUSINESS.CONTRACT.CAPABILITY.APPROVAL@V0100#/operations/approve_case",
      exact_local_dependency_ref:
        "Q.BUSINESS.DEPENDENCY.Q_GATE@V0100",
    }),
    trace_id: "trace-dynamic-gate",
    request_id: "request-dynamic-gate",
  }), store.persistence);

  assert.equal(store.mountCount(), 2);
  assert.equal(store.dependencyCount(), 1);
  assert.equal(store.activePointer()?.mount_set_hash, activeHash);
  assert.equal(result.active_mount_set.mount_set_hash, activeHash);

  const selectedPublication = result.selected_mount.verified_publication;
  assert.ok(
    selectedPublication !== null
      && typeof selectedPublication === "object"
      && !Array.isArray(selectedPublication),
  );
  assert.equal(
    (selectedPublication as JsonObject).capability_contract_ref,
    gateContractRef,
  );

  assert.equal(
    result.dependency_realization_binding.exact_owner_capability_ref,
    "Q.BUSINESS.CAPABILITY.APPROVAL@V0100",
  );
  assert.equal(
    result.dependency_realization_binding.exact_local_dependency_ref,
    "Q.BUSINESS.DEPENDENCY.Q_GATE@V0100",
  );
  assert.equal(
    result.operation_use_binding.exact_receiving_operation_ref,
    "Q.BUSINESS.CONTRACT.CAPABILITY.APPROVAL@V0100#/operations/approve_case",
  );
});

test("dynamic dependency fails closed when the requested Provider is not an ACTIVE mount member", async () => {
  const store = inMemoryPersistence();
  await mountFoundation(store);

  await assert.rejects(
    () => realizeP2DynamicDeclaredDependency(Object.freeze({
      receiving_domain_ref: receivingDomainRef,
      provider_capability_contract_ref:
        "Q.PROVIDER.CONTRACT.CAPABILITY.NOT_MOUNTED@V0100",
      receiving_p1_binding: Object.freeze({
        exact_owner_capability_ref:
          "Q.BUSINESS.CAPABILITY.APPROVAL@V0100",
        exact_receiving_operation_ref:
          "Q.BUSINESS.CONTRACT.CAPABILITY.APPROVAL@V0100#/operations/approve_case",
        exact_local_dependency_ref:
          "Q.BUSINESS.DEPENDENCY.NOT_MOUNTED@V0100",
      }),
      trace_id: "trace-dynamic-missing",
      request_id: "request-dynamic-missing",
    }), store.persistence),
    /exactly one matching Provider Capability/,
  );
  assert.equal(store.mountCount(), 2);
  assert.equal(store.dependencyCount(), 0);
});
