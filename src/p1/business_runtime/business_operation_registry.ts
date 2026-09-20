import { StableRuntimeError, deep_freeze, exact_ref } from "../../p0/runtime_contract.ts";
import type { RuntimeContext, RuntimeOperation } from "../../p0/runtime_contract.ts";

export type BusinessOperationHandler = RuntimeOperation<unknown, unknown>;
export type BusinessEventInterfaceKind = "EVENT_PUBLISH" | "EVENT_CONSUME";

export interface BusinessRegistryEntry {
  readonly object_ref: string;
  readonly object_contract: unknown;
  readonly registry_rule: unknown;
}

export interface BusinessEventInterfaceBinding {
  readonly capability_contract_ref: string;
  readonly interface_ref: string;
  readonly operation_ref: string;
  readonly surface: "EVENT";
  readonly kind: BusinessEventInterfaceKind;
  /** P1 framework EVENT method identity declared by the exact Capability Interface. */
  readonly method_ref: "publish_business_event" | "consume_business_event";
}

export interface BusinessEventPublishRequest {
  readonly interface_ref: string;
  readonly operation_ref: string;
  readonly input: unknown;
  readonly runtime_context: RuntimeContext;
}

export interface BusinessEventPublisher {
  publish(request: Readonly<BusinessEventPublishRequest>): unknown | Promise<unknown>;
}

const operations = new Map<string, BusinessOperationHandler>();
const business_objects = new Map<string, BusinessRegistryEntry>();
const event_interfaces = new Map<string, BusinessEventInterfaceBinding>();

function nonEmptyString(value: string, field: string): string {
  if (value.length === 0) {
    throw new StableRuntimeError("P1_EVENT_BINDING_INVALID", `${field} must be a non-empty string`);
  }
  return value;
}

function exactCapabilityMember(
  capabilityContractRef: string,
  memberRef: string,
  memberKind: "operations" | "interfaces",
  field: string,
): string {
  if (!exact_ref(capabilityContractRef) || capabilityContractRef.includes("#/")) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "capability_contract_ref must be an exact versioned Capability Contract ref",
    );
  }
  const exact = nonEmptyString(memberRef, field);
  if (!exact_ref(exact) || !exact.startsWith(`${capabilityContractRef}#/${memberKind}/`)) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      `${field} must be an exact member of capability_contract_ref`,
    );
  }
  return exact;
}


export function register_business_operation(operation_ref: string, handler: BusinessOperationHandler): void {
  const existing = operations.get(operation_ref);
  if (existing !== undefined && existing !== handler) {
    throw new StableRuntimeError("P1_OPERATION_DUPLICATE", "Operation ref already has a different handler");
  }
  operations.set(operation_ref, handler);
}

export function resolve_business_operation(operation_ref: string): BusinessOperationHandler {
  const handler = operations.get(operation_ref);
  if (handler === undefined) {
    throw new StableRuntimeError("P1_OPERATION_NOT_REGISTERED", "Operation ref is not registered");
  }
  return handler;
}

export async function invoke_business_operation(
  operation_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
): Promise<unknown> {
  return await resolve_business_operation(operation_ref)(input, runtime_context);
}

export function registered_business_operation_refs(): readonly string[] {
  return deep_freeze([...operations.keys()].sort());
}

/**
 * Registers one exact concrete Capability EVENT Interface-to-Operation binding.
 *
 * The concrete Capability Contract remains semantic authority. Runtime transport,
 * caller input, channel identity, and source-code discovery are never allowed to
 * select or override the bound Operation.
 */
export function register_business_event_interface(
  binding: Readonly<BusinessEventInterfaceBinding>,
): BusinessEventInterfaceBinding {
  const capabilityContractRef = nonEmptyString(
    binding.capability_contract_ref,
    "capability_contract_ref",
  );
  const interfaceRef = exactCapabilityMember(
    capabilityContractRef,
    binding.interface_ref,
    "interfaces",
    "interface_ref",
  );
  const operationRef = exactCapabilityMember(
    capabilityContractRef,
    binding.operation_ref,
    "operations",
    "operation_ref",
  );
  if (binding.surface !== "EVENT") {
    throw new StableRuntimeError("P1_EVENT_BINDING_INVALID", "EVENT binding surface must equal EVENT");
  }
  const methodRef = nonEmptyString(binding.method_ref, "method_ref");
  if (binding.kind !== "EVENT_PUBLISH" && binding.kind !== "EVENT_CONSUME") {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      "EVENT binding kind must be EVENT_PUBLISH or EVENT_CONSUME",
    );
  }
  const expectedMethodRef =
    binding.kind === "EVENT_PUBLISH" ? "publish_business_event" : "consume_business_event";
  if (methodRef !== expectedMethodRef) {
    throw new StableRuntimeError(
      "P1_EVENT_BINDING_INVALID",
      `EVENT ${binding.kind} method_ref must equal ${expectedMethodRef}`,
    );
  }

  const exactBinding = deep_freeze({
    capability_contract_ref: capabilityContractRef,
    interface_ref: interfaceRef,
    operation_ref: operationRef,
    surface: "EVENT",
    kind: binding.kind,
    method_ref: expectedMethodRef,
  } satisfies BusinessEventInterfaceBinding);

  const existing = event_interfaces.get(interfaceRef);
  if (existing !== undefined) {
    if (
      existing.capability_contract_ref !== exactBinding.capability_contract_ref
      || existing.operation_ref !== exactBinding.operation_ref
      || existing.kind !== exactBinding.kind
      || existing.method_ref !== exactBinding.method_ref
    ) {
      throw new StableRuntimeError(
        "P1_EVENT_INTERFACE_DUPLICATE",
        "EVENT interface ref already has a different exact binding",
      );
    }
    return existing;
  }

  event_interfaces.set(interfaceRef, exactBinding);
  return exactBinding;
}

export function resolve_business_event_interface(
  interface_ref: string,
  expected_kind?: BusinessEventInterfaceKind,
): BusinessEventInterfaceBinding {
  const binding = event_interfaces.get(interface_ref);
  if (binding === undefined) {
    throw new StableRuntimeError(
      "P1_EVENT_INTERFACE_NOT_REGISTERED",
      "EVENT interface ref is not registered",
    );
  }
  if (expected_kind !== undefined && binding.kind !== expected_kind) {
    throw new StableRuntimeError(
      "P1_EVENT_INTERFACE_KIND_MISMATCH",
      "EVENT interface kind does not match requested dispatch path",
    );
  }
  return binding;
}

export function registered_business_event_interface_refs(): readonly string[] {
  return deep_freeze([...event_interfaces.keys()].sort());
}

/**
 * P1 EVENT_PUBLISH realization.
 *
 * The exact EVENT_PUBLISH Interface is preverified against its owning Operation.
 * Publication occurs only after that Operation has produced its authoritative
 * fact/finalized outcome. This method therefore does not execute the Operation;
 * it delegates delivery to an injected non-semantic transport publisher.
 */
export async function publish_business_event(
  interface_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
  publisher: BusinessEventPublisher,
): Promise<unknown> {
  const binding = resolve_business_event_interface(interface_ref, "EVENT_PUBLISH");
  if (runtime_context.operation_ref !== binding.operation_ref) {
    throw new StableRuntimeError(
      "P1_EVENT_RUNTIME_CONTEXT_OPERATION_MISMATCH",
      "RuntimeContext operation_ref must equal the exact Operation bound by the EVENT_PUBLISH Interface",
    );
  }
  return await publisher.publish(deep_freeze({
    interface_ref: binding.interface_ref,
    operation_ref: binding.operation_ref,
    input,
    runtime_context,
  } satisfies BusinessEventPublishRequest));
}

/**
 * P1 EVENT_CONSUME realization.
 *
 * Transport supplies the exact Interface identity plus opaque event input/context.
 * The Operation identity is derived only from the preverified Interface binding;
 * transport/caller Operation selection is ignored rather than treated as authority.
 */
export async function consume_business_event(
  interface_ref: string,
  input: unknown,
  runtime_context: RuntimeContext,
): Promise<unknown> {
  const binding = resolve_business_event_interface(interface_ref, "EVENT_CONSUME");
  const boundRuntimeContext = deep_freeze({
    ...runtime_context,
    stage_contract_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0181",
    operation_ref: binding.operation_ref,
  } satisfies RuntimeContext);

  return await invoke_business_operation(
    binding.operation_ref,
    input,
    boundRuntimeContext,
  );
}

/**
 * P1 REGISTRY_REGISTER realization.
 *
 * The registry stores only the exact static object_contract + registry_rule supplied by
 * the governed Capability projection. It does not infer public interfaces, expand a
 * provider surface, execute a business Operation, or derive any unresolved hash.
 */
export function register_business_object(
  object_ref: string,
  object_contract: unknown,
  registry_rule: unknown,
): BusinessRegistryEntry {
  const existing = business_objects.get(object_ref);
  if (existing !== undefined) {
    if (existing.object_contract !== object_contract || existing.registry_rule !== registry_rule) {
      throw new Error("Business registry object ref already has different static registry material");
    }
    return existing;
  }

  const entry = deep_freeze({
    object_ref,
    object_contract,
    registry_rule,
  } satisfies BusinessRegistryEntry);

  business_objects.set(object_ref, entry);
  return entry;
}

/** P1 REGISTRY_RESOLVE realization using the exact registered object_ref as resolution key. */
export function resolve_business_object(resolution_key: string): BusinessRegistryEntry {
  const entry = business_objects.get(resolution_key);
  if (entry === undefined) {
    throw new Error("Business registry resolution key is not registered");
  }
  return entry;
}

/** P1 REGISTRY_LOOKUP realization; lookup is read-only and never invokes business Operations. */
export function lookup_business_object(lookup_query: string): BusinessRegistryEntry | undefined {
  return business_objects.get(lookup_query);
}
