import { StableRuntimeError, deep_freeze } from "../../p0/runtime_contract.ts";
import type { RuntimeContext, RuntimeOperation } from "../../p0/runtime_contract.ts";

export type BusinessOperationHandler = RuntimeOperation<unknown, unknown>;

export interface BusinessRegistryEntry {
  readonly object_ref: string;
  readonly object_contract: unknown;
  readonly registry_rule: unknown;
}

const operations = new Map<string, BusinessOperationHandler>();
const business_objects = new Map<string, BusinessRegistryEntry>();

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
 * P1 V0179 REGISTRY_REGISTER realization.
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

/** P1 V0179 REGISTRY_RESOLVE realization using the exact registered object_ref as resolution key. */
export function resolve_business_object(resolution_key: string): BusinessRegistryEntry {
  const entry = business_objects.get(resolution_key);
  if (entry === undefined) {
    throw new Error("Business registry resolution key is not registered");
  }
  return entry;
}

/** P1 V0179 REGISTRY_LOOKUP realization; lookup is read-only and never invokes business Operations. */
export function lookup_business_object(lookup_query: string): BusinessRegistryEntry | undefined {
  return business_objects.get(lookup_query);
}
