import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;

export interface P2OperationRequest {
  readonly input: JsonObject;
  readonly runtime_context: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface P2OperationResponse {
  readonly outcome_type: "response";
  readonly runtime_result: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}

export class P2StableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "P2StableError";
    this.code = code;
  }
}

function objectValue(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be an object`);
  }
  return value as JsonObject;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be a non-empty string`);
  }
  return value;
}

function sha256Value(value: unknown, field: string): string {
  const text = stringValue(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
    throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", `${field} must be an exact sha256 binding`);
  }
  return text;
}

function arrayValue(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be an array`);
  }
  return value;
}

function optionalObject(value: unknown, field: string): JsonObject | undefined {
  if (value === undefined) return undefined;
  return objectValue(value, field);
}

function optionalArray(value: unknown, field: string): readonly unknown[] | undefined {
  if (value === undefined) return undefined;
  return arrayValue(value, field);
}

function boolValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new P2StableError("P2_INVALID_INPUT", `${field} must be boolean`);
  }
  return value;
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(stableClone));
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = stableClone(source[key]);
    return Object.freeze(out);
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(stableClone(value));
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`;
}

function success(request: P2OperationRequest, runtime_result: JsonObject): P2OperationResponse {
  return Object.freeze({
    outcome_type: "response" as const,
    runtime_result: Object.freeze({ ...runtime_result }),
    trace_id: request.trace_id,
    request_id: request.request_id,
  });
}

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0114" as const;

export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "execute_mounted_capability" as const;

export interface MountedCapabilityExecutionDependencies {
  invoke_local_p0(input: Readonly<{
    readonly exact_interface_binding: JsonObject;
    readonly operation_input: unknown;
    readonly runtime_context: JsonObject;
    readonly trace_id: string;
    readonly request_id: string;
  }>): Promise<unknown>;
}

export async function handler(
  request: P2OperationRequest,
  dependencies: MountedCapabilityExecutionDependencies,
): Promise<P2OperationResponse> {
  const active_mount = objectValue(request.input.active_mount, "active_mount");
  if (active_mount.status !== "ACTIVE") throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "active mount required");
  sha256Value(active_mount.mount_hash, "active_mount.mount_hash");
  const exact_interface_binding = objectValue(request.input.exact_interface_binding, "exact_interface_binding");
  for (const forbidden of ["translation", "mapping", "wrapper", "second_protocol"]) {
    if (exact_interface_binding[forbidden] === true) {
      throw new P2StableError("P2_PROTOCOL_TRANSLATION_FORBIDDEN", "exact Q Interface semantics must be preserved");
    }
  }
  stringValue(exact_interface_binding.interface_ref, "exact_interface_binding.interface_ref");
  const operation_input = request.input.operation_input;
  const runtime_result = await dependencies.invoke_local_p0({
    exact_interface_binding,
    operation_input,
    runtime_context: request.runtime_context,
    trace_id: request.trace_id,
    request_id: request.request_id,
  });
  return success(request, {
    result_kind: "MOUNTED_CAPABILITY_EXECUTION",
    mounted_execution: Object.freeze({
      runtime_contract_ref: "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134",
      exact_interface_binding: stableClone(exact_interface_binding),
      interface_binding_hash: sha256Json(exact_interface_binding),
      runtime_result: stableClone(runtime_result),
      second_runtime_used: false,
    }),
  });
}
