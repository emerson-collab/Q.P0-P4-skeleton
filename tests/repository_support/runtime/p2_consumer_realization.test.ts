import assert from "node:assert/strict";
import test from "node:test";

import {
  P2_CONSUMER_REALIZATION_SEQUENCE,
  realizeP2ConsumerDependency,
} from "../../../runtime/p2_consumer_realization.ts";
import type {
  JsonObject,
  P2ConsumerRealizationPersistence,
} from "../../../runtime/p2_consumer_realization.ts";

function asObject(value: unknown, field: string): JsonObject {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${field} must be an object`,
  );
  return value as JsonObject;
}

function inMemoryPersistence(): Readonly<{
  persistence: P2ConsumerRealizationPersistence;
  activePointer(): JsonObject | undefined;
  dependencyBinding(input: Readonly<{
    receiving_domain_ref: string;
    exact_local_dependency_ref: string;
    active_mount_set_hash: string;
  }>): JsonObject | undefined;
}> {
  const mounts = new Map<string, JsonObject>();
  const mountSets = new Map<string, JsonObject>();
  const dependencyBindings = new Map<string, JsonObject>();
  let pointer: JsonObject | undefined;

  const dependencyKey = (input: Readonly<{
    receiving_domain_ref: string;
    exact_local_dependency_ref: string;
    active_mount_set_hash: string;
  }>) => `${input.receiving_domain_ref}\u0000${input.exact_local_dependency_ref}\u0000${input.active_mount_set_hash}`;

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
      dependencyBindings.set(dependencyKey(input), input.binding);
    },
    async read_dependency_binding_record(input) {
      return dependencyBindings.get(dependencyKey(input));
    },
  });

  return Object.freeze({
    persistence,
    activePointer: () => pointer,
    dependencyBinding: (input) => dependencyBindings.get(dependencyKey(input)),
  });
}

function fixture() {
  const providerContractRef =
    "Q.PROVIDER.CONTRACT.CAPABILITY.EXAMPLE@V0100";
  const exactInterfaceRef = `${providerContractRef}#/interfaces/run_invoke`;
  const publicationHash = `sha256:${"b".repeat(64)}`;
  return Object.freeze({
    providerContractRef,
    publication: Object.freeze({
      immutable: true,
      capability_contract_ref: providerContractRef,
      capability_contract_hash: `sha256:${"c".repeat(64)}`,
      provider_interface_refs: Object.freeze([exactInterfaceRef]),
      publication_hash: publicationHash,
      publication_artifact_binding: Object.freeze({
        immutable: true,
        artifact_ref:
          "Q.CAPABILITY_PACKAGE.PROVIDER.EXAMPLE@V0100#/implementation_material",
        content_hash: `sha256:${"d".repeat(64)}`,
        entry_symbol_ref: "entry/example.ts#entry",
        provider_neutral_locator_binding: Object.freeze({ kind: "test" }),
      }),
    }),
    verification: Object.freeze({
      integrity_verified: true,
      local_material_binding_ref: "local:mounted-provider:example",
    }),
  });
}

test(
  "V0136 repository runtime durably closes mount activation into exact receiving-P1 dependency realization",
  async () => {
    const store = inMemoryPersistence();
    const source = fixture();
    const receivingDomainRef = "Q.RECEIVER@V0100";
    const receivingOperationRef =
      "Q.RECEIVER.CONTRACT.CAPABILITY.EXAMPLE@V0100#/operations/use_provider";
    const localDependencyRef = "Q.RECEIVER.DEPENDENCY.PROVIDER@V0100";

    const result = await realizeP2ConsumerDependency(Object.freeze({
      publication: source.publication,
      verification: source.verification,
      receiving_domain_ref: receivingDomainRef,
      receiving_p1_binding: Object.freeze({
        exact_owner_capability_ref: "Q.RECEIVER.CAPABILITY.EXAMPLE@V0100",
        exact_receiving_operation_ref: receivingOperationRef,
        exact_local_dependency_ref: localDependencyRef,
      }),
      trace_id: "trace-v0136",
      request_id: "request-v0136",
    }), store.persistence);

    assert.deepEqual(result.operation_sequence, P2_CONSUMER_REALIZATION_SEQUENCE);
    assert.equal(result.active_mount_set.status, "ACTIVE");
    assert.equal(
      store.activePointer()?.mount_set_hash,
      result.active_mount_set.mount_set_hash,
    );

    const dependency = asObject(
      result.dependency_realization_binding,
      "dependency_realization_binding",
    );
    assert.equal(
      dependency.exact_owner_capability_ref,
      "Q.RECEIVER.CAPABILITY.EXAMPLE@V0100",
    );
    assert.equal(
      dependency.exact_receiving_operation_ref,
      receivingOperationRef,
    );
    assert.equal(dependency.exact_local_dependency_ref, localDependencyRef);
    assert.equal(dependency.creates_or_writes_p1_business_semantics, false);

    const durableDependency = store.dependencyBinding({
      receiving_domain_ref: receivingDomainRef,
      exact_local_dependency_ref: localDependencyRef,
      active_mount_set_hash: String(result.active_mount_set.mount_set_hash),
    });
    assert.deepEqual(durableDependency, dependency);

    const operationUse = asObject(
      result.operation_use_binding,
      "operation_use_binding",
    );
    assert.equal(
      operationUse.exact_receiving_operation_ref,
      receivingOperationRef,
    );
    assert.equal(operationUse.exact_local_dependency_ref, localDependencyRef);
    assert.equal(operationUse.provider_capability_reowned, false);
    assert.equal(operationUse.p1_business_semantics_written, false);
  },
);

test(
  "V0136 repository runtime rejects an undeclared/empty receiving-P1 dependency identity before mount materialization",
  async () => {
    const store = inMemoryPersistence();
    const source = fixture();

    await assert.rejects(
      () => realizeP2ConsumerDependency(Object.freeze({
        publication: source.publication,
        verification: source.verification,
        receiving_domain_ref: "Q.RECEIVER@V0100",
        receiving_p1_binding: Object.freeze({
          exact_owner_capability_ref: "Q.RECEIVER.CAPABILITY.EXAMPLE@V0100",
          exact_receiving_operation_ref:
            "Q.RECEIVER.CONTRACT.CAPABILITY.EXAMPLE@V0100#/operations/use_provider",
          exact_local_dependency_ref: "",
        }),
        trace_id: "trace-v0136-invalid",
        request_id: "request-v0136-invalid",
      }), store.persistence),
      /exact_local_dependency_ref must be a non-empty exact identity/,
    );
    assert.equal(store.activePointer(), undefined);
  },
);
