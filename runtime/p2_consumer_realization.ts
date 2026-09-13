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
  recover_active_mount_set_with_owner,
} from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import type {
  OwnerLocalActiveMountSetPersistencePort,
} from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import {
  handler as realizeDependency,
  persist_dependency_realization_with_owner,
} from "../src/p2/consumer/p1_dependency_realization/realize_dependency/handler.ts";
import type {
  OwnerLocalDependencyBindingPersistencePort,
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
  & OwnerLocalActiveMountSetPersistencePort
  & OwnerLocalDependencyBindingPersistencePort;

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

export interface P2ConsumerDependencyRecoveryInput {
  readonly receiving_domain_ref: string;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
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

export interface P2ConsumerDependencyRecoveryResult {
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

function request(
  input: JsonObject,
  context: Readonly<{
    runtime_context?: JsonObject;
    trace_id: string;
    request_id: string;
  }>,
) {
  return Object.freeze({
    input,
    runtime_context: context.runtime_context ?? Object.freeze({}),
    trace_id: nonEmptyString(context.trace_id, "trace_id"),
    request_id: nonEmptyString(context.request_id, "request_id"),
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

function assertDurableDependencyMatchesRecoveredActiveSet(
  binding: JsonObject,
  activeMountSet: JsonObject,
  declaredBinding: Readonly<ReceivingP1DependencyBinding>,
): void {
  if (
    binding.exact_owner_capability_ref !== declaredBinding.exact_owner_capability_ref
    || binding.exact_receiving_operation_ref !== declaredBinding.exact_receiving_operation_ref
    || binding.exact_local_dependency_ref !== declaredBinding.exact_local_dependency_ref
  ) {
    throw new TypeError(
      "durable dependency realization does not match the exact receiving-P1 declaration",
    );
  }
  if (binding.source_binding_kind !== "ACTIVE_MOUNT_SET_MEMBER") {
    throw new TypeError(
      "restart dependency recovery requires an ACTIVE_MOUNT_SET_MEMBER durable realization",
    );
  }
  const providerBinding = objectValue(
    binding.verified_provider_binding_or_governed_data_binding,
    "dependency_realization_binding.verified_provider_binding_or_governed_data_binding",
  );
  const activeMountSetHash = nonEmptyString(
    activeMountSet.mount_set_hash,
    "active_mount_set.mount_set_hash",
  );
  if (
    providerBinding.source_binding_kind !== "ACTIVE_MOUNT_SET_MEMBER"
    || providerBinding.active_mount_set_hash !== activeMountSetHash
  ) {
    throw new TypeError(
      "durable dependency realization is not bound to the recovered current active mount set",
    );
  }
  const providerCapabilityContractRef = nonEmptyString(
    providerBinding.provider_capability_contract_ref,
    "dependency_realization_binding.provider_capability_contract_ref",
  );
  const selectedMount = objectValue(
    providerBinding.selected_mount,
    "dependency_realization_binding.selected_mount",
  );
  assertSelectedMountIsActiveMember(
    activeMountSet,
    providerCapabilityContractRef,
    selectedMount,
  );
  const recoveredMounts = objectArray(
    activeMountSet.member_mounts,
    "active_mount_set.member_mounts",
  );
  const selectedMountHash = nonEmptyString(
    selectedMount.mount_hash,
    "dependency_realization_binding.selected_mount.mount_hash",
  );
  const exactRecoveredMount = recoveredMounts.filter((candidate) => {
    if (candidate.mount_hash !== selectedMountHash) return false;
    const publication = objectValue(
      candidate.verified_publication,
      "active_mount_set.member_mounts[].verified_publication",
    );
    return publication.capability_contract_ref === providerCapabilityContractRef;
  });
  if (exactRecoveredMount.length !== 1) {
    throw new TypeError(
      "durable dependency selected mount is not the exact recovered active mount member",
    );
  }
}

async function bindDurableOperationUse(
  dependencyRealizationBinding: JsonObject,
  declaredBinding: Readonly<ReceivingP1DependencyBinding>,
  context: Readonly<{
    runtime_context?: JsonObject;
    trace_id: string;
    request_id: string;
  }>,
): Promise<JsonObject> {
  const operationUse = await bindOperationUse(request(Object.freeze({
    dependency_realization_binding: dependencyRealizationBinding,
    operation_use: Object.freeze({
      exact_receiving_operation_ref: declaredBinding.exact_receiving_operation_ref,
      exact_local_dependency_ref: declaredBinding.exact_local_dependency_ref,
    }),
  }), context));
  return objectValue(
    operationUse.runtime_result.operation_use_binding,
    "operation_use_binding",
  );
}

/**
 * Non-semantic repository runtime support for the V0138 Skeleton P2 Consumer
 * realization closure. It sequences existing P2 V0124 Operations and owner-local
 * durability. It does not define a new Q Interface, Operation, Capability,
 * dependency, Provider surface, database owner, or Runtime.
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

  const consumed = await consumePublication(request(Object.freeze({
    publication: input.publication,
    verification: input.verification,
  }), input));
  const verifiedPublication = objectValue(
    consumed.runtime_result.verified_publication,
    "verified_publication",
  );

  const mounted = await createMount(request(Object.freeze({
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
  const createdSet = await createMountSet(request(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    mounts,
  }), input));
  const mountSet = objectValue(createdSet.runtime_result.mount_set, "mount_set");
  await persist_created_mount_set_with_owner(mountSet, mounts, persistence);

  const activated = await activateMountSet(request(Object.freeze({
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

  const dependency = await realizeDependency(request(Object.freeze({
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

  await persist_dependency_realization_with_owner(
    receivingDomainRef,
    dependencyRealizationBinding,
    persistence,
  );

  const operationUseBinding = await bindDurableOperationUse(
    dependencyRealizationBinding,
    declaredBinding,
    input,
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

/**
 * Pointer-first restart recovery for one predeclared receiving-P1 dependency.
 * The active mount set and implementation material are recovered/reverified
 * first; the durable dependency binding is then resolved by the exact current
 * owner Capability + receiving Operation + local dependency + active_mount_set_hash
 * and revalidated before operation use is reconstructed.
 */
export async function recoverP2ConsumerDependency(
  input: P2ConsumerDependencyRecoveryInput,
  persistence: P2ConsumerRealizationPersistence,
): Promise<P2ConsumerDependencyRecoveryResult> {
  const receivingDomainRef = nonEmptyString(
    input.receiving_domain_ref,
    "receiving_domain_ref",
  );
  const declaredBinding = receivingBinding(input.receiving_p1_binding);
  const activeMountSet = await recover_active_mount_set_with_owner(
    receivingDomainRef,
    persistence,
  );
  const activeMountSetHash = nonEmptyString(
    activeMountSet.mount_set_hash,
    "active_mount_set.mount_set_hash",
  );
  const durableBinding = await persistence.read_dependency_binding_record(
    Object.freeze({
      receiving_domain_ref: receivingDomainRef,
      exact_owner_capability_ref: declaredBinding.exact_owner_capability_ref,
      exact_receiving_operation_ref: declaredBinding.exact_receiving_operation_ref,
      exact_local_dependency_ref: declaredBinding.exact_local_dependency_ref,
      active_mount_set_hash: activeMountSetHash,
    }),
  );
  if (durableBinding === undefined) {
    throw new TypeError(
      "exact durable dependency realization binding is missing for the recovered active mount set",
    );
  }
  assertDurableDependencyMatchesRecoveredActiveSet(
    durableBinding,
    activeMountSet,
    declaredBinding,
  );
  const operationUseBinding = await bindDurableOperationUse(
    durableBinding,
    declaredBinding,
    input,
  );
  return Object.freeze({
    active_mount_set: activeMountSet,
    dependency_realization_binding: durableBinding,
    operation_use_binding: operationUseBinding,
  });
}
