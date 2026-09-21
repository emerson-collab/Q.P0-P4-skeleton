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
  handler as executeMountedCapability,
} from "../src/p2/consumer/external_capability_mounting/execute_mounted_capability/handler.ts";
import type {
  MountedCapabilityExecutionDependencies,
} from "../src/p2/consumer/external_capability_mounting/execute_mounted_capability/handler.ts";
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

export const P2_CONSUMER_MOUNT_SEQUENCE = Object.freeze([
  "consume_publication",
  "create_mount",
  "create_mount_set",
  "activate_mount_set",
] as const);

export const P2_CONSUMER_REALIZATION_SEQUENCE = Object.freeze([
  ...P2_CONSUMER_MOUNT_SEQUENCE,
  "realize_dependency",
  "bind_operation_use",
] as const);

export interface ReceivingP1DependencyBinding {
  readonly exact_owner_capability_ref: string;
  readonly exact_receiving_operation_ref: string;
  readonly exact_local_dependency_ref: string;
}

export type P2ConsumerMountPersistence =
  & OwnerLocalMountRecordPersistencePort
  & OwnerLocalMountSetPersistencePort
  & OwnerLocalActiveMountSetPersistencePort;

export type P2ConsumerRealizationPersistence =
  & P2ConsumerMountPersistence
  & OwnerLocalDependencyBindingPersistencePort;

export interface P2ConsumerMountRealizationInput {
  readonly publication: JsonObject;
  readonly verification: JsonObject;
  readonly receiving_domain_ref: string;
  readonly mount_policy?: JsonObject;
  readonly additional_retained_mounts?: readonly JsonObject[];
  readonly current_active_mount_set?: JsonObject;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2ConsumerMountRealizationResult {
  readonly operation_sequence: typeof P2_CONSUMER_MOUNT_SEQUENCE;
  readonly verified_publication: JsonObject;
  readonly mount: JsonObject;
  readonly mount_set: JsonObject;
  readonly active_mount_set: JsonObject;
}

export interface P2ConsumerDeclaredDependencyInput {
  readonly receiving_domain_ref: string;
  readonly active_mount_set: JsonObject;
  readonly selected_mount: JsonObject;
  readonly provider_capability_contract_ref: string;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2ConsumerDeclaredDependencyResult {
  readonly dependency_realization_binding: JsonObject;
  readonly operation_use_binding: JsonObject;
}

export interface P2ConsumerDependencyRealizationInput
  extends P2ConsumerMountRealizationInput {
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
}

export interface P2ConsumerDependencyRecoveryInput {
  readonly receiving_domain_ref: string;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2ConsumerMountedExecutionInput {
  readonly receiving_domain_ref: string;
  readonly requested_provider_capability_contract_ref: string;
  readonly exact_interface_binding: JsonObject;
  readonly operation_input: unknown;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2ConsumerMountedExecutionResult {
  readonly active_mount_set: JsonObject;
  readonly mounted_execution: JsonObject;
  readonly execution_receipt: JsonObject;
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
 * Mount-only receiving-Skeleton P2 Consumer realization.
 *
 * This closes the existing P2 V0125 mount lifecycle at an ACTIVE mount set.
 * It intentionally requires no receiving-P1 dependency declaration and creates
 * no P1 dependency, Operation, Interface, wrapper, protocol, or second Runtime.
 */
export async function realizeP2ConsumerMount(
  input: P2ConsumerMountRealizationInput,
  persistence: P2ConsumerMountPersistence,
): Promise<P2ConsumerMountRealizationResult> {
  const receivingDomainRef = nonEmptyString(
    input.receiving_domain_ref,
    "receiving_domain_ref",
  );

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

  return Object.freeze({
    operation_sequence: P2_CONSUMER_MOUNT_SEQUENCE,
    verified_publication: verifiedPublication,
    mount,
    mount_set: mountSet,
    active_mount_set: activeMountSet,
  });
}

/** Resolve/reverify mount state after restart without requiring a P1 dependency. */
export async function recoverP2ConsumerMount(
  receiving_domain_ref: string,
  persistence: P2ConsumerMountPersistence,
): Promise<JsonObject> {
  return await recover_active_mount_set_with_owner(
    nonEmptyString(receiving_domain_ref, "receiving_domain_ref"),
    persistence,
  );
}

/**
 * Execute one exact Interface from an independently ACTIVE mounted capability.
 * The existing execute_mounted_capability Operation remains semantic authority;
 * receiving-local P0 invocation is supplied through its existing dependency port.
 */
export async function executeP2MountedCapability(
  input: P2ConsumerMountedExecutionInput,
  persistence: P2ConsumerMountPersistence,
  dependencies: MountedCapabilityExecutionDependencies,
): Promise<P2ConsumerMountedExecutionResult> {
  const activeMountSet = await recoverP2ConsumerMount(
    input.receiving_domain_ref,
    persistence,
  );
  const executed = await executeMountedCapability(request(Object.freeze({
    active_mount_set: activeMountSet,
    requested_provider_capability_contract_ref:
      nonEmptyString(
        input.requested_provider_capability_contract_ref,
        "requested_provider_capability_contract_ref",
      ),
    exact_interface_binding: input.exact_interface_binding,
    operation_input: input.operation_input,
  }), input), dependencies);
  return Object.freeze({
    active_mount_set: activeMountSet,
    mounted_execution: objectValue(
      executed.runtime_result.mounted_execution,
      "mounted_execution",
    ),
    execution_receipt: objectValue(
      executed.runtime_result.execution_receipt,
      "execution_receipt",
    ),
  });
}

/**
 * Realize only an already-declared receiving-P1 dependency against an exact
 * member of an already ACTIVE mount set.
 */
export async function realizeP2DeclaredDependency(
  input: P2ConsumerDeclaredDependencyInput,
  persistence: P2ConsumerRealizationPersistence,
): Promise<P2ConsumerDeclaredDependencyResult> {
  const receivingDomainRef = nonEmptyString(
    input.receiving_domain_ref,
    "receiving_domain_ref",
  );
  const declaredBinding = receivingBinding(input.receiving_p1_binding);
  const providerCapabilityContractRef = nonEmptyString(
    input.provider_capability_contract_ref,
    "provider_capability_contract_ref",
  );
  assertSelectedMountIsActiveMember(
    input.active_mount_set,
    providerCapabilityContractRef,
    input.selected_mount,
  );

  const dependency = await realizeDependency(request(Object.freeze({
    verified_provider_binding_or_governed_data_binding: Object.freeze({
      source_binding_kind: "ACTIVE_MOUNT_SET_MEMBER",
      active_mount_set_hash: input.active_mount_set.mount_set_hash,
      provider_capability_contract_ref: providerCapabilityContractRef,
      selected_mount: input.selected_mount,
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
    dependency_realization_binding: dependencyRealizationBinding,
    operation_use_binding: operationUseBinding,
  });
}

/**
 * Compatibility closure for a caller that intentionally requests both mount
 * realization and one predeclared receiving-P1 dependency in the same call.
 * Mount completion itself remains independent.
 */
export async function realizeP2ConsumerDependency(
  input: P2ConsumerDependencyRealizationInput,
  persistence: P2ConsumerRealizationPersistence,
): Promise<P2ConsumerDependencyRealizationResult> {
  const mounted = await realizeP2ConsumerMount(input, persistence);
  const providerCapabilityContractRef = nonEmptyString(
    mounted.verified_publication.capability_contract_ref,
    "verified_publication.capability_contract_ref",
  );
  const dependency = await realizeP2DeclaredDependency(Object.freeze({
    receiving_domain_ref: input.receiving_domain_ref,
    active_mount_set: mounted.active_mount_set,
    selected_mount: mounted.mount,
    provider_capability_contract_ref: providerCapabilityContractRef,
    receiving_p1_binding: input.receiving_p1_binding,
    runtime_context: input.runtime_context,
    trace_id: input.trace_id,
    request_id: input.request_id,
  }), persistence);

  return Object.freeze({
    operation_sequence: P2_CONSUMER_REALIZATION_SEQUENCE,
    verified_publication: mounted.verified_publication,
    mount: mounted.mount,
    mount_set: mounted.mount_set,
    active_mount_set: mounted.active_mount_set,
    dependency_realization_binding: dependency.dependency_realization_binding,
    operation_use_binding: dependency.operation_use_binding,
  });
}

/**
 * Pointer-first restart recovery for one predeclared receiving-P1 dependency.
 * The active mount set and implementation material are recovered/reverified
 * first; the durable dependency binding is then resolved by the exact current
 * five-field durable key and revalidated before operation use is reconstructed.
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
