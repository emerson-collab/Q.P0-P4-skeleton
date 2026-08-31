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

export interface ImplementationMaterialResolver {
  resolve_implementation_artifact(input: Readonly<{
    artifact_ref: string;
    provider_neutral_locator_binding: JsonObject;
    entry_symbol_ref: string;
  }>): Promise<Readonly<{
    artifact_bytes: Uint8Array | string;
    local_material_binding_ref: string;
  }>>;
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

function sha256Bytes(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function success(request: P2OperationRequest, runtime_result: JsonObject): P2OperationResponse {
  return Object.freeze({
    outcome_type: "response" as const,
    runtime_result: Object.freeze({ ...runtime_result }),
    trace_id: request.trace_id,
    request_id: request.request_id,
  });
}

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0117" as const;
export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "consume_publication" as const;

export async function handler(
  request: P2OperationRequest,
  resolver: ImplementationMaterialResolver,
): Promise<P2OperationResponse> {
  const publication = objectValue(request.input.publication, "publication");
  if (publication.immutable !== true) {
    throw new P2StableError("P2_PUBLICATION_INVALID", "publication must be immutable");
  }

  const capability_contract_ref = stringValue(publication.capability_contract_ref, "publication.capability_contract_ref");
  const capability_contract_hash = sha256Value(publication.capability_contract_hash, "publication.capability_contract_hash");
  const publication_hash = sha256Value(publication.publication_hash, "publication.publication_hash");
  const verification = objectValue(request.input.verification, "verification");
  if (verification.integrity_verified !== true) {
    throw new P2StableError("P2_PUBLICATION_NOT_VERIFIED", "publication integrity must be verified");
  }

  const binding = objectValue(publication.publication_artifact_binding, "publication.publication_artifact_binding");
  const implementation_artifact_ref = stringValue(binding.artifact_ref, "publication.publication_artifact_binding.artifact_ref");
  const implementation_artifact_hash = sha256Value(binding.content_hash, "publication.publication_artifact_binding.content_hash");
  const provider_neutral_locator_binding = objectValue(
    binding.provider_neutral_locator_binding,
    "publication.publication_artifact_binding.provider_neutral_locator_binding",
  );
  const entry_symbol_ref = stringValue(binding.entry_symbol_ref, "publication.publication_artifact_binding.entry_symbol_ref");

  const resolved = await resolver.resolve_implementation_artifact({
    artifact_ref: implementation_artifact_ref,
    provider_neutral_locator_binding,
    entry_symbol_ref,
  });
  if (sha256Bytes(resolved.artifact_bytes) !== implementation_artifact_hash) {
    throw new P2StableError(
      "P2_INTEGRITY_BINDING_INVALID",
      "resolved implementation artifact hash does not match the exact publication binding",
    );
  }
  const local_material_binding_ref = stringValue(
    resolved.local_material_binding_ref,
    "resolved.local_material_binding_ref",
  );

  const binding_payload = Object.freeze({
    publication_hash,
    implementation_artifact_ref,
    implementation_artifact_hash,
    provider_neutral_locator_binding: stableClone(provider_neutral_locator_binding),
    entry_symbol_ref,
    local_material_binding_ref,
  });
  const resolver_state = Object.freeze({
    ...binding_payload,
    binding_hash: sha256Json(binding_payload),
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
