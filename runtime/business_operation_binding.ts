import { StableRuntimeError } from "../src/p0/runtime_contract.ts";
import {
  register_business_operation,
  resolve_business_operation,
  type BusinessOperationHandler,
} from "../src/p1/business_runtime/business_operation_registry.ts";

export type ExplicitPortBoundBusinessOperationHandler = (
  request: unknown,
  ports: unknown,
) => unknown | Promise<unknown>;

export interface BusinessOperationPortBinding {
  readonly operation_ref: string;
  readonly handler: ExplicitPortBoundBusinessOperationHandler;
  readonly ports: unknown;
}

interface InstalledBinding {
  readonly handler: ExplicitPortBoundBusinessOperationHandler;
  readonly ports: unknown;
  readonly bound_handler: BusinessOperationHandler;
}

const installedBindings = new Map<string, InstalledBinding>();

function exactOperationRef(value: string): string {
  if (value.length === 0) {
    throw new StableRuntimeError("P1_RUNTIME_OPERATION_BINDING_INVALID", "operation_ref must be a non-empty exact ref");
  }
  return value;
}

export function operationIdFromExactOperationRef(operationRef: string): string {
  const exactRef = exactOperationRef(operationRef);
  const marker = "#/operations/";
  const markerIndex = exactRef.lastIndexOf(marker);
  if (markerIndex <= 0) {
    throw new StableRuntimeError(
      "P1_RUNTIME_OPERATION_REF_INVALID",
      "operation_ref must contain one exact #/operations/<operation_id> suffix",
    );
  }
  const operationId = exactRef.slice(markerIndex + marker.length);
  if (!/^[a-z0-9_]+$/.test(operationId) || operationId.includes("/")) {
    throw new StableRuntimeError(
      "P1_RUNTIME_OPERATION_REF_INVALID",
      "operation_ref operation_id suffix is invalid",
    );
  }
  return operationId;
}

export function bindBusinessOperationPort(binding: BusinessOperationPortBinding): void {
  const operationRef = exactOperationRef(binding.operation_ref);
  operationIdFromExactOperationRef(operationRef);
  const existing = installedBindings.get(operationRef);
  if (existing !== undefined) {
    if (existing.handler === binding.handler && existing.ports === binding.ports) return;
    throw new StableRuntimeError(
      "P1_RUNTIME_OPERATION_BINDING_DUPLICATE",
      "operation_ref already has a different explicit runtime port binding",
    );
  }

  const boundHandler: BusinessOperationHandler = (request) => binding.handler(request, binding.ports);
  installedBindings.set(operationRef, Object.freeze({
    handler: binding.handler,
    ports: binding.ports,
    bound_handler: boundHandler,
  }));
  register_business_operation(operationRef, boundHandler);
}

export async function invokeBoundBusinessOperation(operationRef: string, request: unknown): Promise<unknown> {
  return resolve_business_operation(exactOperationRef(operationRef))(request);
}

export function boundBusinessOperationRefs(): readonly string[] {
  return Object.freeze([...installedBindings.keys()].sort());
}
