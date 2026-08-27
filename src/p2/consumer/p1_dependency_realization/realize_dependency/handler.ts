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
export const CAPABILITY_ID = "p1_dependency_realization" as const;
export const OPERATION_ID = "realize_dependency" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const verified_provider_binding_or_governed_data_binding = objectValue(
    request.input.verified_provider_binding_or_governed_data_binding,
    "verified_provider_binding_or_governed_data_binding",
  );
  const receiving_p1_binding = objectValue(request.input.receiving_p1_binding, "receiving_p1_binding");
  const exact_owner_capability_ref = stringValue(receiving_p1_binding.exact_owner_capability_ref, "receiving_p1_binding.exact_owner_capability_ref");
  const exact_receiving_operation_ref = stringValue(receiving_p1_binding.exact_receiving_operation_ref, "receiving_p1_binding.exact_receiving_operation_ref");
  const exact_local_dependency_ref = stringValue(receiving_p1_binding.exact_local_dependency_ref, "receiving_p1_binding.exact_local_dependency_ref");
  if (request.input.create_p1_dependency === true) {
    throw new P2StableError("P2_P1_DEPENDENCY_CREATION_FORBIDDEN", "P2.Consumer may only realize an already-declared P1 dependency");
  }
  const payload = stableClone({
    verified_provider_binding_or_governed_data_binding,
    exact_owner_capability_ref,
    exact_receiving_operation_ref,
    exact_local_dependency_ref,
    p1_dependency_interface_ref: "Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0174#/interfaces/dependency_invoke",
  }) as JsonObject;
  return success(request, {
    result_kind: "P1_DEPENDENCY_REALIZATION_BINDING",
    dependency_realization_binding: Object.freeze({
      ...payload,
      binding_hash: sha256Json(payload),
      creates_or_writes_p1_business_semantics: false,
    }),
  });
}
