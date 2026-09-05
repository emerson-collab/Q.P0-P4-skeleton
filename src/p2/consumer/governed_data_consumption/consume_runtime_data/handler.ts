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

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0118" as const;

export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "governed_data_consumption" as const;
export const OPERATION_ID = "consume_runtime_data" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const governed_data_material = objectValue(request.input.governed_data_material, "governed_data_material");
  if (governed_data_material.data_category !== "RUNTIME") {
    throw new P2StableError("P2_DATA_CATEGORY_MISMATCH", "expected RUNTIME governed data");
  }
  const verification = objectValue(request.input.verification, "verification");
  if (verification.integrity_verified !== true) {
    throw new P2StableError("P2_GOVERNED_DATA_NOT_VERIFIED", "integrity verification required before consumption");
  }
  const source_domain_identity = stringValue(governed_data_material.source_domain_identity, "governed_data_material.source_domain_identity");
  const subject_identity = stringValue(governed_data_material.subject_identity, "governed_data_material.subject_identity");
  const source_fact_authority = stringValue(governed_data_material.source_fact_authority, "governed_data_material.source_fact_authority");
  const governed_access_binding = objectValue(governed_data_material.governed_access_binding, "governed_data_material.governed_access_binding");
  const integrity_binding = objectValue(governed_data_material.integrity_binding, "governed_data_material.integrity_binding");
  const source_provenance = objectValue(governed_data_material.source_provenance, "governed_data_material.source_provenance");
  const source_revision = stringValue(governed_data_material.source_revision, "governed_data_material.source_revision");
  
  return success(request, {
    result_kind: "GOVERNED_DATA_CONSUMPTION_BINDING",
    data_consumption_binding: Object.freeze({
      data_category: "RUNTIME",
      source_domain_identity,
      subject_identity,
      source_revision,
      source_fact_authority,
      source_provenance: stableClone(source_provenance),
      governed_access_binding: stableClone(governed_access_binding),
      integrity_binding: stableClone(integrity_binding),
      source_material_hash: sha256Json(governed_data_material),
      verification: stableClone(verification),
      full_memory_assembly_performed: false,
      creates_evidence_or_gate_result: false,
    }),
  });
}
