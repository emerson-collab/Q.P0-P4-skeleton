import assert from "node:assert/strict";
import test from "node:test";

import {
  P2_CONSUMER_DEPENDENCY_SEQUENCE,
  P2_CONSUMER_MOUNT_SEQUENCE,
  executeP2MountedCapability,
  realizeP2ConsumerMount,
  realizeP2DeclaredDependency,
  recoverP2ConsumerDependency,
  recoverP2ConsumerMount,
} from "../../../runtime/p2_consumer_realization.ts";
import type {
  JsonObject,
  P2ConsumerDependencyPersistence,
  P2ConsumerMountPersistence,
  P2ConsumerRealizationPersistence,
} from "../../../runtime/p2_consumer_realization.ts";

function asObject(value: unknown, field: string): JsonObject {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${field} must be an object`);
  return value as JsonObject;
}

function stores() {
  const mounts = new Map<string, JsonObject>();
  const mountSets = new Map<string, JsonObject>();
  const dependencies = new Map<string, JsonObject>();
  let pointer: JsonObject | undefined;
  let dependencyWrites = 0;

  const mountPersistence: P2ConsumerMountPersistence = Object.freeze({
    async persist_mount_record({ receiving_domain_ref, mount_hash, mount }) {
      mounts.set(`${receiving_domain_ref}\u0000${mount_hash}`, structuredClone(mount) as JsonObject);
    },
    async read_mount_record({ receiving_domain_ref, mount_hash }) {
      return mounts.get(`${receiving_domain_ref}\u0000${mount_hash}`);
    },
    async persist_mount_set_record({ receiving_domain_ref, mount_set_hash, mount_set }) {
      mountSets.set(`${receiving_domain_ref}\u0000${mount_set_hash}`, structuredClone(mount_set) as JsonObject);
    },
    async read_mount_set_record({ receiving_domain_ref, mount_set_hash }) {
      return mountSets.get(`${receiving_domain_ref}\u0000${mount_set_hash}`);
    },
    async reverify_implementation_material() {
      return;
    },
    async read_active_mount_set_pointer({ receiving_domain_ref }) {
      return pointer?.receiving_domain_ref === receiving_domain_ref ? pointer : undefined;
    },
    async switch_active_mount_set_pointer({ receiving_domain_ref, mount_set_hash }) {
      pointer = Object.freeze({ receiving_domain_ref, mount_set_hash, status: "ACTIVE" });
    },
  });

  const dependencyKey = (input: Readonly<{
    receiving_domain_ref: string;
    exact_owner_capability_ref: string;
    exact_receiving_operation_ref: string;
    exact_local_dependency_ref: string;
    active_mount_set_hash: string;
  }>) => [
    input.receiving_domain_ref,
    input.exact_owner_capability_ref,
    input.exact_receiving_operation_ref,
    input.exact_local_dependency_ref,
    input.active_mount_set_hash,
  ].join("\u0000");

  const dependencyPersistence: P2ConsumerDependencyPersistence = Object.freeze({
    async persist_dependency_binding_record(input) {
      dependencyWrites += 1;
      dependencies.set(dependencyKey(input), structuredClone(input.binding) as JsonObject);
    },
    async read_dependency_binding_record(input) {
      return dependencies.get(dependencyKey(input));
    },
  });

  const combined: P2ConsumerRealizationPersistence = Object.freeze({
    ...mountPersistence,
    ...dependencyPersistence,
  });

  return Object.freeze({
    mountPersistence,
    dependencyPersistence,
    combined,
    dependencyWrites: () => dependencyWrites,
    clearDependencies: () => dependencies.clear(),
  });
}

function fixture() {
  const providerContractRef = "Q.PROVIDER.CONTRACT.CAPABILITY.EXAMPLE@V0100";
  const exactInterfaceRef = `${providerContractRef}#/interfaces/run_invoke`;
  const exactOperationRef = `${providerContractRef}#/operations/run`;
  return Object.freeze({
    providerContractRef,
    exactInterfaceRef,
    exactOperationRef,
    publication: Object.freeze({
      immutable: true,
      capability_contract_ref: providerContractRef,
      capability_contract_hash: `sha256:${"c".repeat(64)}`,
      provider_interface_refs: Object.freeze([exactInterfaceRef]),
      publication_hash: `sha256:${"b".repeat(64)}`,
      publication_artifact_binding: Object.freeze({
        immutable: true,
        artifact_ref: "Q.CAPABILITY_PACKAGE.PROVIDER.EXAMPLE@V0100#/implementation_material",
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

const receivingDomainRef = "Q.RECEIVER@V0100";
const receivingBinding = Object.freeze({
  exact_owner_capability_ref: "Q.RECEIVER.CONTRACT.CAPABILITY.EXAMPLE@V0100",
  exact_receiving_operation_ref:
    "Q.RECEIVER.CONTRACT.CAPABILITY.EXAMPLE@V0100#/operations/use_provider",
  exact_local_dependency_ref: "Q.RECEIVER.DEPENDENCY.PROVIDER@V0100",
});

test("mount-only realization closes at ACTIVE mount set without any P1 dependency persistence", async () => {
  const store = stores();
  const source = fixture();
  const result = await realizeP2ConsumerMount(Object.freeze({
    publication: source.publication,
    verification: source.verification,
    receiving_domain_ref: receivingDomainRef,
    trace_id: "trace-mount-only",
    request_id: "request-mount-only",
  }), store.mountPersistence);

  assert.deepEqual(result.operation_sequence, P2_CONSUMER_MOUNT_SEQUENCE);
  assert.deepEqual(result.operation_sequence, [
    "consume_publication",
    "create_mount",
    "create_mount_set",
    "activate_mount_set",
  ]);
  assert.equal(result.active_mount_set.status, "ACTIVE");
  assert.equal(store.dependencyWrites(), 0);
});

test("mounted capability executes from recovered ACTIVE mount through receiving local P0 dependency", async () => {
  const store = stores();
  const source = fixture();
  await realizeP2ConsumerMount(Object.freeze({
    publication: source.publication,
    verification: source.verification,
    receiving_domain_ref: receivingDomainRef,
    trace_id: "trace-mount-execute",
    request_id: "request-mount-execute",
  }), store.mountPersistence);

  let localP0Calls = 0;
  const result = await executeP2MountedCapability(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    requested_provider_capability_contract_ref: source.providerContractRef,
    exact_interface_binding: Object.freeze({
      interface_ref: source.exactInterfaceRef,
      operation_ref: source.exactOperationRef,
    }),
    operation_input: Object.freeze({ value: 7 }),
    runtime_context: Object.freeze({ invocation_id: "invoke-1", binding_set_ref: "binding-set-1" }),
    trace_id: "trace-execute",
    request_id: "request-execute",
  }), store.mountPersistence, Object.freeze({
    async invoke_local_p0(input) {
      localP0Calls += 1;
      assert.equal(input.exact_interface_binding.interface_ref, source.exactInterfaceRef);
      assert.equal(input.implementation_binding.verified, true);
      return Object.freeze({ ok: true, value: input.operation_input });
    },
  }));

  assert.equal(localP0Calls, 1);
  const mounted = asObject(result.mounted_execution, "mounted_execution");
  assert.equal(mounted.selected_provider_capability_contract_ref, source.providerContractRef);
  const runtimeResult = asObject(mounted.runtime_result, "mounted_execution.runtime_result");
  assert.equal(runtimeResult.ok, true);
  const receipt = asObject(result.execution_receipt, "execution_receipt");
  const receiptPayload = asObject(receipt.receipt_payload, "execution_receipt.receipt_payload");
  assert.equal(receiptPayload.stage_contract_ref, "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0125");
});

test("declared P1 dependency is realized only after ACTIVE mount exists", async () => {
  const store = stores();
  const source = fixture();
  const mounted = await realizeP2ConsumerMount(Object.freeze({
    publication: source.publication,
    verification: source.verification,
    receiving_domain_ref: receivingDomainRef,
    trace_id: "trace-dependency-mount",
    request_id: "request-dependency-mount",
  }), store.mountPersistence);

  assert.equal(store.dependencyWrites(), 0);
  const dependency = await realizeP2DeclaredDependency(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    active_mount_set: mounted.active_mount_set,
    selected_mount: mounted.mount,
    receiving_p1_binding: receivingBinding,
    trace_id: "trace-dependency",
    request_id: "request-dependency",
  }), store.dependencyPersistence);

  assert.deepEqual(dependency.operation_sequence, P2_CONSUMER_DEPENDENCY_SEQUENCE);
  assert.deepEqual(dependency.operation_sequence, ["realize_dependency", "bind_operation_use"]);
  assert.equal(store.dependencyWrites(), 1);
  assert.equal(
    dependency.dependency_realization_binding.exact_local_dependency_ref,
    receivingBinding.exact_local_dependency_ref,
  );
});

test("restart recovery keeps mount-only valid and requires dependency record only for dependency recovery", async () => {
  const store = stores();
  const source = fixture();
  const mounted = await realizeP2ConsumerMount(Object.freeze({
    publication: source.publication,
    verification: source.verification,
    receiving_domain_ref: receivingDomainRef,
    trace_id: "trace-restart-mount",
    request_id: "request-restart-mount",
  }), store.mountPersistence);

  const mountOnlyRecovered = await recoverP2ConsumerMount(
    Object.freeze({ receiving_domain_ref: receivingDomainRef }),
    store.mountPersistence,
  );
  assert.equal(
    mountOnlyRecovered.active_mount_set.mount_set_hash,
    mounted.active_mount_set.mount_set_hash,
  );

  await realizeP2DeclaredDependency(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    active_mount_set: mounted.active_mount_set,
    selected_mount: mounted.mount,
    receiving_p1_binding: receivingBinding,
    trace_id: "trace-restart-dependency",
    request_id: "request-restart-dependency",
  }), store.dependencyPersistence);

  const recoveredDependency = await recoverP2ConsumerDependency(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    receiving_p1_binding: receivingBinding,
    trace_id: "trace-recover-dependency",
    request_id: "request-recover-dependency",
  }), store.combined);
  assert.equal(
    recoveredDependency.dependency_realization_binding.exact_local_dependency_ref,
    receivingBinding.exact_local_dependency_ref,
  );

  store.clearDependencies();
  const stillMounted = await recoverP2ConsumerMount(
    Object.freeze({ receiving_domain_ref: receivingDomainRef }),
    store.mountPersistence,
  );
  assert.equal(stillMounted.active_mount_set.status, "ACTIVE");

  await assert.rejects(
    () => recoverP2ConsumerDependency(Object.freeze({
      receiving_domain_ref: receivingDomainRef,
      receiving_p1_binding: receivingBinding,
      trace_id: "trace-missing-dependency",
      request_id: "request-missing-dependency",
    }), store.combined),
    /exact durable dependency realization binding is missing/,
  );
});
