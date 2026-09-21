import {
  recoverP2ConsumerMount,
} from "./p2_consumer_mount_realization.ts";
import type {
  JsonObject,
} from "./p2_consumer_mount_realization.ts";
import {
  realizeP2DeclaredDependency,
} from "./p2_consumer_p1_dependency_realization.ts";
import type {
  P2ConsumerRealizationPersistence,
  ReceivingP1DependencyBinding,
} from "./p2_consumer_p1_dependency_realization.ts";

export interface P2DynamicDeclaredDependencyInput {
  readonly receiving_domain_ref: string;
  readonly provider_capability_contract_ref: string;
  readonly receiving_p1_binding: ReceivingP1DependencyBinding;
  readonly runtime_context?: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2DynamicDeclaredDependencyResult {
  readonly active_mount_set: JsonObject;
  readonly selected_mount: JsonObject;
  readonly provider_capability_contract_ref: string;
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

function selectedActiveProviderMount(
  activeMountSet: JsonObject,
  providerCapabilityContractRef: string,
): JsonObject {
  const recoveredMounts = objectArray(
    activeMountSet.member_mounts,
    "active_mount_set.member_mounts",
  );

  const matches = recoveredMounts.filter((mount) => {
    const verifiedPublication = objectValue(
      mount.verified_publication,
      "active_mount_set.member_mounts[].verified_publication",
    );
    return verifiedPublication.capability_contract_ref
      === providerCapabilityContractRef;
  });

  if (matches.length !== 1) {
    throw new TypeError(
      "dynamic dependency realization requires exactly one matching Provider Capability in the recovered ACTIVE mount set",
    );
  }
  return matches[0]!;
}

/**
 * Dynamically realize one already-declared receiving-P1 dependency against an
 * already ACTIVE Provider mount.
 *
 * Dynamic input supplies only exact runtime identities. This helper does not
 * create a Provider mount, mutate the active pointer, create a P1 dependency,
 * infer a Provider, or write business semantics. The exact receiving-P1
 * declaration remains external authority and P2 V0125 realize_dependency /
 * bind_operation_use remain the realization authorities.
 */
export async function realizeP2DynamicDeclaredDependency(
  input: P2DynamicDeclaredDependencyInput,
  persistence: P2ConsumerRealizationPersistence,
): Promise<P2DynamicDeclaredDependencyResult> {
  const receivingDomainRef = nonEmptyString(
    input.receiving_domain_ref,
    "receiving_domain_ref",
  );
  const providerCapabilityContractRef = nonEmptyString(
    input.provider_capability_contract_ref,
    "provider_capability_contract_ref",
  );

  const activeMountSet = await recoverP2ConsumerMount(
    receivingDomainRef,
    persistence,
  );
  const selectedMount = selectedActiveProviderMount(
    activeMountSet,
    providerCapabilityContractRef,
  );

  const realized = await realizeP2DeclaredDependency(Object.freeze({
    receiving_domain_ref: receivingDomainRef,
    active_mount_set: activeMountSet,
    selected_mount: selectedMount,
    provider_capability_contract_ref: providerCapabilityContractRef,
    receiving_p1_binding: input.receiving_p1_binding,
    runtime_context: input.runtime_context,
    trace_id: input.trace_id,
    request_id: input.request_id,
  }), persistence);

  return Object.freeze({
    active_mount_set: activeMountSet,
    selected_mount: selectedMount,
    provider_capability_contract_ref: providerCapabilityContractRef,
    dependency_realization_binding: realized.dependency_realization_binding,
    operation_use_binding: realized.operation_use_binding,
  });
}
