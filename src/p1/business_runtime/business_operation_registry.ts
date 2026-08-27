import { StableRuntimeError, deep_freeze } from "../../p0/runtime_contract.ts";

export type BusinessOperationHandler = (input: unknown) => unknown | Promise<unknown>;
const operations = new Map<string, BusinessOperationHandler>();

export function register_business_operation(operation_ref: string, handler: BusinessOperationHandler): void {
  const existing = operations.get(operation_ref);
  if (existing !== undefined && existing !== handler) {
    throw new StableRuntimeError("P1_OPERATION_DUPLICATE", "Operation ref already has a different handler");
  }
  operations.set(operation_ref, handler);
}

export function resolve_business_operation(operation_ref: string): BusinessOperationHandler {
  const handler = operations.get(operation_ref);
  if (handler === undefined) throw new StableRuntimeError("P1_OPERATION_NOT_REGISTERED", "Operation ref is not registered");
  return handler;
}

export function registered_business_operation_refs(): readonly string[] {
  return deep_freeze([...operations.keys()].sort());
}
