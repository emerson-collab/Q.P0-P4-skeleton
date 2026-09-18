import { deep_freeze, exact_ref } from "../src/p0/runtime_contract.ts";

export type JsonObject = Readonly<Record<string, unknown>>;

export interface P1OwnerLocalRuntimeBindingIdentity {
  readonly capability_contract_ref: string;
  readonly operation_ref: string;
  readonly interface_ref: string;
}

export interface P1OwnerLocalRuntimeBindingResolution {
  readonly binding_set_ref?: string;
  readonly attributes: JsonObject;
  readonly port_refs?: readonly string[];
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

function exactCapabilityMember(
  capabilityContractRef: string,
  memberRef: string,
  memberKind: "operations" | "interfaces",
  field: string,
): string {
  const exact = nonEmptyString(memberRef, field);
  if (!exact_ref(exact) || !exact.startsWith(`${capabilityContractRef}#/${memberKind}/`)) {
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
 * Repository-runtime support for resolving one exact owner-local P1 binding.
 *
 * This helper owns no Capability, Operation, Interface, provider selection, or
 * business semantics. The receiving repository supplies the resolver; the
 * Skeleton only preserves exact identity and returns the resolved opaque
 * binding material for injection into the existing P0 RuntimeContext.
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
    operation_ref: exactCapabilityMember(
      capabilityContractRef,
      identity.operation_ref,
      "operations",
      "operation_ref",
    ),
    interface_ref: exactCapabilityMember(
      capabilityContractRef,
      identity.interface_ref,
      "interfaces",
      "interface_ref",
    ),
  });

  const resolved = await resolver.resolveExact(exactIdentity);
  if (resolved === undefined) return undefined;

  const bindingSetRef = resolved.binding_set_ref === undefined
    ? undefined
    : nonEmptyString(resolved.binding_set_ref, "binding_set_ref");
  const portRefs = resolved.port_refs === undefined
    ? undefined
    : resolved.port_refs.map((value, index) => nonEmptyString(value, `port_refs[${index}]`));

  return deep_freeze({
    ...(bindingSetRef === undefined ? {} : { binding_set_ref: bindingSetRef }),
    attributes: { ...attributesObject(resolved.attributes) },
    ...(portRefs === undefined ? {} : { port_refs: [...portRefs] }),
  });
}
