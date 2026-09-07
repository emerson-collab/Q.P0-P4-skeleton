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

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0119" as const;

export const ROLE = "provider" as const;
export const CAPABILITY_ID = "governed_data_exposure" as const;
export const OPERATION_ID = "expose_dynamic_data" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const source_domain_identity = stringValue(request.input.source_domain_identity, "source_domain_identity");
  const subject_identity = stringValue(request.input.subject_identity, "subject_identity");
  const source_revision = stringValue(request.input.source_revision, "source_revision");
  const selection_hash = sha256Value(request.input.selection_hash, "selection_hash");
  const source_provenance = objectValue(request.input.source_provenance, "source_provenance");
  const source_fact_authority = stringValue(request.input.source_fact_authority, "source_fact_authority");
  const governed_access_binding = objectValue(request.input.governed_access_binding, "governed_access_binding");
  const integrity_binding = objectValue(request.input.integrity_binding, "integrity_binding");
  const mode = stringValue(request.input.mode, "mode");
  if (!["INLINE_FACT_SET", "ARTIFACT_SNAPSHOT", "ARTIFACT_CHUNKED_SNAPSHOT"].includes(mode)) {
    throw new P2StableError("P2_DYNAMIC_MODE_INVALID", "unsupported dynamic material mode");
  }
  const inline_facts = optionalArray(request.input.inline_facts, "inline_facts");
  const artifact_snapshot = optionalObject(request.input.artifact_snapshot, "artifact_snapshot");
  const artifact_chunked_snapshot = optionalObject(request.input.artifact_chunked_snapshot, "artifact_chunked_snapshot");
  const present = [inline_facts !== undefined, artifact_snapshot !== undefined, artifact_chunked_snapshot !== undefined].filter(Boolean).length;
  if (present !== 1) throw new P2StableError("P2_DYNAMIC_SNAPSHOT_INVALID", "exactly one dynamic carrier is required");
  if (mode === "INLINE_FACT_SET" && inline_facts === undefined) throw new P2StableError("P2_DYNAMIC_SNAPSHOT_INVALID", "INLINE_FACT_SET requires inline_facts");
  if (mode === "ARTIFACT_SNAPSHOT" && artifact_snapshot === undefined) throw new P2StableError("P2_DYNAMIC_SNAPSHOT_INVALID", "ARTIFACT_SNAPSHOT requires artifact_snapshot");
  if (mode === "ARTIFACT_CHUNKED_SNAPSHOT" && artifact_chunked_snapshot === undefined) throw new P2StableError("P2_DYNAMIC_SNAPSHOT_INVALID", "ARTIFACT_CHUNKED_SNAPSHOT requires artifact_chunked_snapshot");
  if (artifact_chunked_snapshot !== undefined) {
    const manifest = objectValue(artifact_chunked_snapshot.manifest, "artifact_chunked_snapshot.manifest");
    if (manifest.source_revision !== source_revision || manifest.selection_hash !== selection_hash) {
      throw new P2StableError("P2_DYNAMIC_SNAPSHOT_MIXED_REVISION", "manifest must bind the exact frozen revision and selection hash");
    }
    const chunks = arrayValue(artifact_chunked_snapshot.chunks, "artifact_chunked_snapshot.chunks");
    for (const [index, raw] of chunks.entries()) {
      const chunk = objectValue(raw, `chunk[${index}]`);
      if (chunk.source_revision !== source_revision || chunk.selection_hash !== selection_hash) {
        throw new P2StableError("P2_DYNAMIC_SNAPSHOT_MIXED_REVISION", "all chunks must bind the same snapshot");
      }
      sha256Value(chunk.content_hash, `chunk[${index}].content_hash`);
    }
  }
  const payload = stableClone({
    data_category: "DYNAMIC",
    source_domain_identity,
    subject_identity,
    source_revision,
    selection_hash,
    source_provenance,
    source_fact_authority,
    governed_access_binding,
    integrity_binding,
    mode,
    inline_facts,
    artifact_snapshot,
    artifact_chunked_snapshot,
  }) as JsonObject;
  return success(request, {
    result_kind: "GOVERNED_DATA_EXPOSURE",
    governed_data_material: Object.freeze({ ...payload, material_hash: sha256Json(payload) }),
  });
}
