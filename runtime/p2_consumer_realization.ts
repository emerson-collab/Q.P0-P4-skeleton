import {
  handler as consumePublication,
} from "../src/p2/consumer/external_capability_mounting/consume_publication/handler.ts";
import {
  handler as createMount,
  persist_created_mount_with_owner,
} from "../src/p2/consumer/external_capability_mounting/create_mount/handler.ts";
import type {
  OwnerLocalMountRecordPersistencePort,
} from "../src/p2/consumer/external_capability_mounting/create_mount/handler.ts";
import {
  handler as createMountSet,
  persist_created_mount_set_with_owner,
} from "../src/p2/consumer/external_capability_mounting/create_mount_set/handler.ts";
import type {
  OwnerLocalMountSetPersistencePort,
} from "../src/p2/consumer/external_capability_mounting/create_mount_set/handler.ts";
import {
  handler as activateMountSet,
  commit_active_mount_set_with_owner,
} from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import type {
  OwnerLocalActiveMountSetPersistencePort,
} from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import {
  handler as realizeDependency,
} from "../src/p2/consumer/p1_dependency_realization/realize_dependency/handler.ts";
import {
  handler as bindOperationUse,
} from "../src/p2/consumer/p1_dependency_realization/bind_operation_use/handler.ts";

export type JsonObject = Readonly<Record<string, unknown>>;

export const P2_CONSUMER_REALIZATION_SEQUENCE = Object.freeze([
  "consume_publication",
  "create_mount",
  "create_mount_set",
  "activate_mount_set",
  "realize_dependency",
  "bind_operation_use",
] as const);

export interface ReceivingP1DependencyBinding {
  readonly exact_owner_capability_ref: string;
  readonly exact_receiving_operation_ref: string;
  readonly exact_local_dependency_ref: string;
}

export type P2ConsumerRealizationPersistence =
  & OwnerLocalMountRecordPersistencePort
  & OwnerLocalMountSetPersistencePort
  & OwnerLocalActiveMountSetPersistencePort;

export interface P2ConsumerDependencyRealizationInput {
  readonly publication: JsonObject;
  readonly verification: JsonObject;
  readonly receiving_domain_ref: string;
  readonly mount_policy?: JsonObject;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
  readonly additional_retained_mounts?: readonly JsonObject[];
  readonly current_active_mount_set?: JsonObject;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2ConsumerDependencyRealizationResult {
  readonly operation_sequence: typeof P2_CONSUMER_REALIZATION_SEQUENCE;
  readonly verified_publication: JsonObject;
  readonly mount: JsonObject;
  readonly mount_set: JsonObject;
  readonly active_mount_set: JsonObject;
  readonly dependency_realization_binding: JsonObject;
  readonly operation_use_binding: JsonObject;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty exact identity`);
  }
  return value;
}

function objectValue(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as JsonObject;
}

function objectArray(value: unknown, field: string): readonly JsonObject[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty array`);
  }
  return value.map((item, index) => objectValue(item, `${field}[${index}]`));
}

function p2Request(
  input: JsonObject,
  source: P2ConsumerDependencyRealizationInput,
) {
  return Object.freeze({
    input,
    runtime_context: source.runtime_context ?? Object.freeze({}),
    trace_id: nonEmptyString(source.trace_id, "trace_id"),
    request_id: nonEmptyString(source.request_id, "request_id"),
  });
}

function receivingBinding(
  value: ReceivingP1DependencyBinding,
): Readonly<ReceivingP1DependencyBinding> {
  return Object.freeze({
    exact_owner_capability_ref: nonEmptyString(
      value.exact_owner_capability_ref,
      "receiving_p1_binding.exact_owner_capability_ref",
    ),
    exact_receiving_operation_ref: nonEmptyString(
      value.exact_receiving_operation_ref,
      "receiving_p1_binding.exact_receiving_operation_ref",
    ),
    exact_local_dependency_ref: nonEmptyString(
      value.exact_local_dependency_ref,
      "receiving_p1_binding.exact_local_dependency_ref",
    ),
  });
}

function assertSelectedMountIsActiveMember(
  activeMountSet: JsonObject,
  providerCapabilityContractRef: string,
  mount: JsonObject,
): void {
  const mountHash = nonEmptyString(mount.mount_hash, "mount.mount_hash");
  const members = objectArray(activeMountSet.members, "active_mount_set.members");
  const matched = members.filter((member) =>
    member.provider_capability_contract_ref === providerCapabilityContractRef
    && member.mount_hash === mountHash
  );
  if (matched.length !== 1) {
    throw new TypeError(
      "selected Provider Capability mount must be exactly one member of the active mount set",
    );
  }
}

/**
 * Non-semantic repository runtime support for the V0135 Skeleton P2 Consumer
 * realization closure. This function only sequences existing P2 V0122
 * Operations and owner-local persistence. It does not define a new Q Interface,
 * Operation, Capability, dependency, Provider surface, or Runtime.
 */
export async function realizeP2ConsumerDependency(
  input: P2ConsumerDependencyRealizationInput,
  persistence: P2ConsumerRealizationPersistence,
): Promise<P2ConsumerDependencyRealizationResult> {
  const receivingDomainRef = nonEmptyString(
    input.receiving_domain_ref,
    "receiving_domain_ref",
  );
  const declaredBinding = receivingBinding(input.receiving_p1_binding);

  const consumed = await consumePublication(p2Request(Object.freeze({
    publication: input.publication,
    verification: input.verification,
  }), input));
  const verifiedPublication = objectValue(
    consumed.runtime_result.verified_publication,
    "verified_publication",
  );

  const mounted = await createMount(p2Request(Object.freeze({
    verified_publication: verifiedPublication,
    receiving_domain_ref: receivingDomainRef,
    mount_policy: input.mount_policy ?? Object.freeze({}),
  }), input));
  const mount = objectValue(mounted.runtime_result.mount, "mount");
  await persist_created_mount_with_owner(mount, persistence);

  const mounts = Object.freeze([
    ...(input.additional_retained_mounts ?? Object.freeze([])),
    mount,
  ]);
  const createdSet = await createMountSet(p2Request(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    mounts,
  }), input));
  const mountSet = objectValue(createdSet.runtime_result.mount_set, "mount_set");
  await persist_created_mount_set_with_owner(mountSet, mounts, persistence);

  const activated = await activateMountSet(p2Request(Object.freeze({
    mount_set: mountSet,
    ...(input.current_active_mount_set === undefined
      ? {}
      : { current_active_mount_set: input.current_active_mount_set }),
  }), input));
  const activeMountSet = objectValue(
    activated.runtime_result.active_mount_set,
    "active_mount_set",
  );
  await commit_active_mount_set_with_owner(activeMountSet, persistence);

  const providerCapabilityContractRef = nonEmptyString(
    verifiedPublication.capability_contract_ref,
    "verified_publication.capability_contract_ref",
  );
  assertSelectedMountIsActiveMember(
    activeMountSet,
    providerCapabilityContractRef,
    mount,
  );

  const dependency = await realizeDependency(p2Request(Object.freeze({
    verified_provider_binding_or_governed_data_binding: Object.freeze({
      source_binding_kind: "ACTIVE_MOUNT_SET_MEMBER",
      active_mount_set_hash: activeMountSet.mount_set_hash,
      provider_capability_contract_ref: providerCapabilityContractRef,
      selected_mount: mount,
    }),
    receiving_p1_binding: declaredBinding,
    create_p1_dependency: false,
  }), input));
  const dependencyRealizationBinding = objectValue(
    dependency.runtime_result.dependency_realization_binding,
    "dependency_realization_binding",
  );

  const operationUse = await bindOperationUse(p2Request(Object.freeze({
    dependency_realization_binding: dependencyRealizationBinding,
    operation_use: Object.freeze({
      exact_receiving_operation_ref:
        declaredBinding.exact_receiving_operation_ref,
      exact_local_dependency_ref: declaredBinding.exact_local_dependency_ref,
    }),
  }), input));
  const operationUseBinding = objectValue(
    operationUse.runtime_result.operation_use_binding,
    "operation_use_binding",
  );

  return Object.freeze({
    operation_sequence: P2_CONSUMER_REALIZATION_SEQUENCE,
    verified_publication: verifiedPublication,
    mount,
    mount_set: mountSet,
    active_mount_set: activeMountSet,
    dependency_realization_binding: dependencyRealizationBinding,
    operation_use_binding: operationUseBinding,
  });
}
