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

export const ROLE = "provider" as const;
export const CAPABILITY_ID = "capability_publishing" as const;
export const OPERATION_ID = "publish_capability" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const material_set = objectValue(request.input.material_set, "material_set");
  if (material_set.publication_eligible !== true) {
    throw new P2StableError("P2_PUBLICATION_INVALID", "material_set must be publication eligible");
  }

  const capability_contract_ref = stringValue(
    material_set.capability_contract_ref,
    "material_set.capability_contract_ref",
  );
  const capability_contract_hash = sha256Value(
    material_set.capability_contract_hash,
    "material_set.capability_contract_hash",
  );
  const material_set_hash = sha256Value(
    material_set.material_set_hash,
    "material_set.material_set_hash",
  );

  const supplied_binding = objectValue(
    request.input.publication_artifact_binding,
    "publication_artifact_binding",
  );
  if (supplied_binding.immutable !== true) {
    throw new P2StableError(
      "P2_IMPLEMENTATION_MATERIAL_INVALID",
      "publication artifact binding must identify immutable executable implementation material",
    );
  }

  const publication_artifact_binding = Object.freeze({
    artifact_ref: stringValue(
      supplied_binding.artifact_ref,
      "publication_artifact_binding.artifact_ref",
    ),
    content_hash: sha256Value(
      supplied_binding.content_hash,
      "publication_artifact_binding.content_hash",
    ),
    provider_neutral_locator_binding: stableClone(objectValue(
      supplied_binding.provider_neutral_locator_binding,
      "publication_artifact_binding.provider_neutral_locator_binding",
    )) as JsonObject,
    entry_symbol_ref: stringValue(
      supplied_binding.entry_symbol_ref,
      "publication_artifact_binding.entry_symbol_ref",
    ),
    immutable: true,
  });

  for (const disallowed of ["mutable_repository_path", "raw_provider_url", "launcher_owned_binding"]) {
    if (supplied_binding[disallowed] !== undefined) {
      throw new P2StableError(
        "P2_IMPLEMENTATION_MATERIAL_INVALID",
        `${disallowed} is not executable publication material`,
      );
    }
  }

  const payload = stableClone({
    capability_contract_ref,
    capability_contract_hash,
    material_set_hash,
    publication_artifact_binding,
    provider_lineage: material_set.provider_lineage,
    dependency_closure: material_set.dependency_closure,
  }) as JsonObject;

  return success(request, {
    result_kind: "IMMUTABLE_PUBLICATION",
    publication: Object.freeze({
      ...payload,
      publication_hash: sha256Json(payload),
      immutable: true,
      provider_business_runtime_used: false,
    }),
  });
}
