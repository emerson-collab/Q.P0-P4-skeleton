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
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "consume_publication" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const publication = objectValue(request.input.publication, "publication");
  if (publication.immutable !== true) throw new P2StableError("P2_PUBLICATION_INVALID", "publication must be immutable");
  const capability_contract_ref = stringValue(publication.capability_contract_ref, "publication.capability_contract_ref");
  const capability_contract_hash = sha256Value(publication.capability_contract_hash, "publication.capability_contract_hash");
  const publication_hash = sha256Value(publication.publication_hash, "publication.publication_hash");
  const implementation_material_binding = objectValue(publication.implementation_material_binding, "publication.implementation_material_binding");
  if (implementation_material_binding.immutable !== true) {
    throw new P2StableError("P2_IMPLEMENTATION_MATERIAL_INVALID", "implementation material binding must be immutable");
  }
  stringValue(implementation_material_binding.artifact_ref, "publication.implementation_material_binding.artifact_ref");
  sha256Value(implementation_material_binding.content_hash, "publication.implementation_material_binding.content_hash");
  objectValue(implementation_material_binding.provider_neutral_locator_binding, "publication.implementation_material_binding.provider_neutral_locator_binding");
  stringValue(implementation_material_binding.entry_symbol_ref, "publication.implementation_material_binding.entry_symbol_ref");
  const implementation_binding_hash = sha256Value(
    publication.implementation_binding_hash,
    "publication.implementation_binding_hash",
  );
  const computed_implementation_binding_hash = sha256Json(implementation_material_binding);
  if (implementation_binding_hash !== computed_implementation_binding_hash) {
    throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "implementation binding hash must match exact publication material");
  }
  const verification = objectValue(request.input.verification, "verification");
  if (verification.integrity_verified !== true) throw new P2StableError("P2_PUBLICATION_NOT_VERIFIED", "publication integrity must be verified");
  const resolver_state = Object.freeze({
    implementation_material_binding: stableClone(implementation_material_binding),
    implementation_binding_hash,
    verification: stableClone(verification),
    verified: true,
  });
  return success(request, {
    result_kind: "VERIFIED_PUBLICATION",
    verified_publication: Object.freeze({
      publication: stableClone(publication),
      capability_contract_ref,
      capability_contract_hash,
      publication_hash,
      verification: stableClone(verification),
      resolver_state,
      verified: true,
    }),
  });
}
