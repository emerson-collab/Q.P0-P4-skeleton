import { deep_freeze, exact_ref } from "../src/p0/runtime_contract.ts";

export type JsonObject = Readonly<Record<string, unknown>>;

export interface P1OwnerLocalRuntimeBindingIdentity {
  readonly capability_contract_ref: string;
  readonly operation_ref: string;
  readonly interface_ref: string;
  readonly binding_set_ref: string;
  readonly port_refs: readonly string[];
}

export interface P1OwnerLocalRuntimeBindingResolution {
  readonly attributes: JsonObject;
}

export interface P1OwnerLocalRuntimeBindingResolver {
  resolveExact(
    identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
  ):
    | P1OwnerLocalRuntimeBindingResolution
    | undefined
    | Promise<P1OwnerLocalRuntimeBindingResolution | undefined>;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function exactCapabilityInterfaceMember(
  capabilityContractRef: string,
  memberRef: string,
  field: string,
): string {
  const exact = nonEmptyString(memberRef, field);
  if (!exact_ref(exact) || !exact.startsWith(`${capabilityContractRef}#/interfaces/`)) {
    throw new TypeError(`${field} must be an exact member of capability_contract_ref`);
  }
  return exact;
}

function exactCapabilityOperationMember(
  capabilityContractRef: string,
  memberRef: string,
  field: string,
): string {
  const exact = nonEmptyString(memberRef, field);
  if (
    !exact_ref(exact)
    || (
      !exact.startsWith(`${capabilityContractRef}#/operations/`)
      && !exact.startsWith(`${capabilityContractRef}#/operation_catalog/`)
    )
  ) {
    throw new TypeError(`${field} must be an exact member of capability_contract_ref`);
  }
  return exact;
}

function attributesObject(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("owner-local runtime binding attributes must be an object");
  }
  return value as JsonObject;
}

/**
 * Repository-runtime support for resolving one already-selected owner-local P1 binding.
 *
 * Capability Instance / binding authority selects binding_set_ref and port_refs before
 * runtime resolution. This helper owns no Capability, Operation, Interface, Port,
 * Provider, or binding selection semantics; it only resolves opaque runtime resources
 * for the exact already-governed identity supplied by the receiving repository.
 */
export async function resolve_p1_owner_local_runtime_binding(
  identity: Readonly<P1OwnerLocalRuntimeBindingIdentity>,
  resolver: P1OwnerLocalRuntimeBindingResolver,
): Promise<P1OwnerLocalRuntimeBindingResolution | undefined> {
  const capabilityContractRef = nonEmptyString(
    identity.capability_contract_ref,
    "capability_contract_ref",
  );
  if (!exact_ref(capabilityContractRef)) {
    throw new TypeError("capability_contract_ref must be exact-versioned");
  }

  const exactIdentity = deep_freeze({
    capability_contract_ref: capabilityContractRef,
    operation_ref: exactCapabilityOperationMember(
      capabilityContractRef,
      identity.operation_ref,
      "operation_ref",
    ),
    interface_ref: exactCapabilityInterfaceMember(
      capabilityContractRef,
      identity.interface_ref,
      "interface_ref",
    ),
    binding_set_ref: nonEmptyString(identity.binding_set_ref, "binding_set_ref"),
    port_refs: identity.port_refs.map((value, index) =>
      nonEmptyString(value, `port_refs[${index}]`)
    ),
  } satisfies P1OwnerLocalRuntimeBindingIdentity);

  const resolved = await resolver.resolveExact(exactIdentity);
  if (resolved === undefined) return undefined;

  return deep_freeze({
    attributes: { ...attributesObject(resolved.attributes) },
  });
}
