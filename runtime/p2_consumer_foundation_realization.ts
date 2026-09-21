import {
  handler as consumePublication,
} from "../src/p2/consumer/external_capability_mounting/consume_publication/handler.ts";
import {
  handler as createMount,
  persist_created_mount_with_owner,
} from "../src/p2/consumer/external_capability_mounting/create_mount/handler.ts";
import {
  handler as createMountSet,
  persist_created_mount_set_with_owner,
} from "../src/p2/consumer/external_capability_mounting/create_mount_set/handler.ts";
import {
  handler as activateMountSet,
  commit_active_mount_set_with_owner,
} from "../src/p2/consumer/external_capability_mounting/activate_mount_set/handler.ts";
import {
  realizeP2DeclaredDependency,
} from "./p2_consumer_p1_dependency_realization.ts";
import type {
  P2ConsumerRealizationPersistence,
  ReceivingP1DependencyBinding,
} from "./p2_consumer_p1_dependency_realization.ts";

export type JsonObject = Readonly<Record<string, unknown>>;

export const P2_FOUNDATION_REALIZATION_SEQUENCE = Object.freeze([
  "consume_publication",
  "create_mount",
  "persist_mount",
  "create_mount_set",
  "activate_mount_set",
  "realize_dependency",
  "bind_operation_use",
] as const);

export interface P2FoundationProviderInput {
  readonly publication: JsonObject;
  readonly verification: JsonObject;
  readonly mount_policy?: JsonObject;
}

export interface P2FoundationDependencyInput {
  readonly provider_capability_contract_ref: string;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
}

export interface P2FoundationRealizationInput {
  readonly receiving_domain_ref: string;
  readonly providers: readonly P2FoundationProviderInput[];
  readonly declared_dependencies?: readonly P2FoundationDependencyInput[];
  readonly additional_retained_mounts?: readonly JsonObject[];
  readonly current_active_mount_set?: JsonObject;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2FoundationDependencyResult {
  readonly provider_capability_contract_ref: string;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
  readonly dependency_realization_binding: JsonObject;
  readonly operation_use_binding: JsonObject;
}

export interface P2FoundationRealizationResult {
  readonly operation_sequence: typeof P2_FOUNDATION_REALIZATION_SEQUENCE;
  readonly mounts: readonly JsonObject[];
  readonly mount_set: JsonObject;
  readonly active_mount_set: JsonObject;
  readonly dependency_results: readonly P2FoundationDependencyResult[];
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

function providerContractRefFromMount(mount: JsonObject): string {
  const verifiedPublication = objectValue(
    mount.verified_publication,
    "mount.verified_publication",
  );
  return nonEmptyString(
    verifiedPublication.capability_contract_ref,
    "mount.verified_publication.capability_contract_ref",
  );
}

function selectExactProviderMount(
  mounts: readonly JsonObject[],
  providerCapabilityContractRef: string,
): JsonObject {
  const exact = mounts.filter((mount) =>
    providerContractRefFromMount(mount) === providerCapabilityContractRef
  );
  if (exact.length !== 1) {
    throw new TypeError(
      "declared dependency must resolve exactly one retained Provider Capability mount",
    );
  }
  return exact[0]!;
}

/**
 * Generic receiving-Skeleton foundation realization.
 *
 * The Skeleton owns only orchestration over existing P2 V0125 Operations.
 * Provider Capability semantics, Provider selection, and receiving-P1 dependency
 * declarations remain caller-supplied governed inputs.
 *
 * All Provider mounts are persisted first, one immutable mount set is then
 * created and activated once, and only after ACTIVE state exists are already-
 * declared P1 dependencies realized and bound to their receiving Operations.
 */
export async function realizeP2Foundation(
  input: P2FoundationRealizationInput,
  persistence: P2ConsumerRealizationPersistence,
): Promise<P2FoundationRealizationResult> {
  const receivingDomainRef = nonEmptyString(
    input.receiving_domain_ref,
    "receiving_domain_ref",
  );
  if (!Array.isArray(input.providers) || input.providers.length === 0) {
    throw new TypeError("providers must be a non-empty governed Provider set");
  }

  const newMounts: JsonObject[] = [];
  const providerRefs = new Set<string>();

  for (const [index, provider] of input.providers.entries()) {
    const consumed = await consumePublication(request(Object.freeze({
      publication: provider.publication,
      verification: provider.verification,
    }), input));
    const verifiedPublication = objectValue(
      consumed.runtime_result.verified_publication,
      `providers[${index}].verified_publication`,
    );
    const providerRef = nonEmptyString(
      verifiedPublication.capability_contract_ref,
      `providers[${index}].capability_contract_ref`,
    );
    if (providerRefs.has(providerRef)) {
      throw new TypeError(
        "foundation Provider set must contain unique exact Capability Contract refs",
      );
    }
    providerRefs.add(providerRef);

    const created = await createMount(request(Object.freeze({
      verified_publication: verifiedPublication,
      receiving_domain_ref: receivingDomainRef,
      mount_policy: provider.mount_policy ?? Object.freeze({}),
    }), input));
    const mount = objectValue(
      created.runtime_result.mount,
      `providers[${index}].mount`,
    );
    await persist_created_mount_with_owner(mount, persistence);
    newMounts.push(mount);
  }

  const mounts = Object.freeze([
    ...(input.additional_retained_mounts ?? Object.freeze([])),
    ...newMounts,
  ]);

  const createdSet = await createMountSet(request(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    mounts,
  }), input));
  const mountSet = objectValue(
    createdSet.runtime_result.mount_set,
    "foundation.mount_set",
  );
  await persist_created_mount_set_with_owner(mountSet, mounts, persistence);

  const activated = await activateMountSet(request(Object.freeze({
    mount_set: mountSet,
    ...(input.current_active_mount_set === undefined
      ? {}
      : { current_active_mount_set: input.current_active_mount_set }),
  }), input));
  const activeMountSet = objectValue(
    activated.runtime_result.active_mount_set,
    "foundation.active_mount_set",
  );
  await commit_active_mount_set_with_owner(activeMountSet, persistence);

  const dependencyResults: P2FoundationDependencyResult[] = [];
  for (const dependency of input.declared_dependencies ?? Object.freeze([])) {
    const providerCapabilityContractRef = nonEmptyString(
      dependency.provider_capability_contract_ref,
      "declared_dependency.provider_capability_contract_ref",
    );
    const selectedMount = selectExactProviderMount(
      mounts,
      providerCapabilityContractRef,
    );
    const realized = await realizeP2DeclaredDependency(Object.freeze({
      receiving_domain_ref: receivingDomainRef,
      active_mount_set: activeMountSet,
      selected_mount: selectedMount,
      provider_capability_contract_ref: providerCapabilityContractRef,
      receiving_p1_binding: dependency.receiving_p1_binding,
      runtime_context: input.runtime_context,
      trace_id: input.trace_id,
      request_id: input.request_id,
    }), persistence);
    dependencyResults.push(Object.freeze({
      provider_capability_contract_ref: providerCapabilityContractRef,
      receiving_p1_binding: Object.freeze({
        ...dependency.receiving_p1_binding,
      }),
      dependency_realization_binding: realized.dependency_realization_binding,
      operation_use_binding: realized.operation_use_binding,
    }));
  }

  return Object.freeze({
    operation_sequence: P2_FOUNDATION_REALIZATION_SEQUENCE,
    mounts,
    mount_set: mountSet,
    active_mount_set: activeMountSet,
    dependency_results: Object.freeze(dependencyResults),
  });
}
