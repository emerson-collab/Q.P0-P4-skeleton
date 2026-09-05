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
export const OPERATION_ID = "rollback_mount" as const;

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const active_mount = objectValue(request.input.active_mount, "active_mount");
  if (active_mount.status !== "ACTIVE") throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "active mount required");
  const active_mount_hash = sha256Value(active_mount.mount_hash, "active_mount.mount_hash");
  const rollback_target_mount = objectValue(request.input.rollback_target_mount, "rollback_target_mount");
  const target_hash = sha256Value(rollback_target_mount.mount_hash, "rollback_target_mount.mount_hash");
  const target_publication = objectValue(rollback_target_mount.verified_publication, "rollback_target_mount.verified_publication");
  if (target_publication.verified !== true) throw new P2StableError("P2_MOUNT_NOT_VERIFIED", "rollback target must preserve verified publication");
  const resolver_state = objectValue(rollback_target_mount.resolver_state, "rollback_target_mount.resolver_state");
  if (resolver_state.verified !== true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED", "rollback target must preserve verified resolver state");
  const implementation_binding_hash = sha256Value(
    rollback_target_mount.implementation_binding_hash,
    "rollback_target_mount.implementation_binding_hash",
  );
  const resolver_binding_hash = sha256Value(
    resolver_state.implementation_binding_hash,
    "rollback_target_mount.resolver_state.implementation_binding_hash",
  );
  if (implementation_binding_hash !== resolver_binding_hash) {
    throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "rollback target and resolver state must preserve the same implementation binding");
  }
  return success(request, {
    result_kind: "ACTIVE_MOUNT",
    active_mount: Object.freeze({
      ...stableClone(rollback_target_mount) as JsonObject,
      mount_hash: target_hash,
      resolver_state: stableClone(resolver_state),
      implementation_binding_hash,
      status: "ACTIVE",
      rolled_back_from_mount_hash: active_mount_hash,
      activation_order: "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST",
    }),
  });
}
