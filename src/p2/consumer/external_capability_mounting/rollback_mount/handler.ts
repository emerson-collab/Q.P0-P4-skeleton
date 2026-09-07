import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;
export interface P2OperationRequest { readonly input: JsonObject; readonly runtime_context: JsonObject; readonly trace_id: string; readonly request_id: string; }
export interface P2OperationResponse { readonly outcome_type: "response"; readonly runtime_result: JsonObject; readonly trace_id: string; readonly request_id: string; }
export class P2StableError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.name = "P2StableError"; this.code = code; } }
function objectValue(value: unknown, field: string): JsonObject { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new P2StableError("P2_INVALID_INPUT", `${field} must be an object`); return value as JsonObject; }
function stringValue(value: unknown, field: string): string { if (typeof value !== "string" || value.length === 0) throw new P2StableError("P2_INVALID_INPUT", `${field} must be a non-empty string`); return value; }
function sha256Value(value: unknown, field: string): string { const text = stringValue(value, field); if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", `${field} must be an exact sha256 binding`); return text; }
function optionalObject(value: unknown, field: string): JsonObject | undefined { if (value === undefined) return undefined; return objectValue(value, field); }
function stableClone(value: unknown): unknown { if (Array.isArray(value)) return Object.freeze(value.map(stableClone)); if (value !== null && typeof value === "object") { const source = value as Record<string, unknown>; const out: Record<string, unknown> = {}; for (const key of Object.keys(source).sort()) out[key] = stableClone(source[key]); return Object.freeze(out); } return value; }
function canonical(value: unknown): string { return JSON.stringify(stableClone(value)); }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`; }
function success(request: P2OperationRequest, runtime_result: JsonObject): P2OperationResponse { return Object.freeze({ outcome_type: "response" as const, runtime_result: Object.freeze({ ...runtime_result }), trace_id: request.trace_id, request_id: request.request_id }); }

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0119" as const;
export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "rollback_mount" as const;

function resolverIdentity(resolver_state: JsonObject): Readonly<{publication_hash:string; binding_hash:string}> {
  if (resolver_state.verified !== true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED", "rollback target must preserve verified resolver state");
  const publication_hash = sha256Value(resolver_state.publication_hash, "resolver_state.publication_hash");
  const implementation_artifact_ref = stringValue(resolver_state.implementation_artifact_ref, "resolver_state.implementation_artifact_ref");
  const implementation_artifact_hash = sha256Value(resolver_state.implementation_artifact_hash, "resolver_state.implementation_artifact_hash");
  const entry_symbol_ref = stringValue(resolver_state.entry_symbol_ref, "resolver_state.entry_symbol_ref");
  const local_material_binding_ref = stringValue(resolver_state.local_material_binding_ref, "resolver_state.local_material_binding_ref");
  const binding_hash = sha256Value(resolver_state.binding_hash, "resolver_state.binding_hash");
  const expected = sha256Json({ publication_hash, implementation_artifact_ref, implementation_artifact_hash, entry_symbol_ref, local_material_binding_ref });
  if (binding_hash !== expected) throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "resolver_state.binding_hash does not match exact resolved implementation material");
  return Object.freeze({ publication_hash, binding_hash });
}

function mountIdentity(mount: JsonObject, field: string): Readonly<{mount_hash:string; implementation_binding_hash:string; resolver_state:JsonObject}> {
  const receiving_domain_ref = stringValue(mount.receiving_domain_ref, `${field}.receiving_domain_ref`);
  const publication_hash = sha256Value(mount.publication_hash, `${field}.publication_hash`);
  const publication = objectValue(mount.verified_publication, `${field}.verified_publication`);
  if (publication.verified !== true) throw new P2StableError("P2_MOUNT_NOT_VERIFIED", "mount publication must remain verified");
  const resolver_state = objectValue(mount.resolver_state, `${field}.resolver_state`);
  const resolver = resolverIdentity(resolver_state);
  if (resolver.publication_hash !== publication_hash) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "mount publication hash and resolver_state publication hash must match");
  const implementation_binding_hash = sha256Value(mount.implementation_binding_hash, `${field}.implementation_binding_hash`);
  if (implementation_binding_hash !== sha256Json(resolver_state)) throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "mount must bind the exact canonical resolver_state");
  const mount_policy = optionalObject(mount.mount_policy, `${field}.mount_policy`) ?? Object.freeze({});
  const mount_hash = sha256Value(mount.mount_hash, `${field}.mount_hash`);
  const expected_mount_hash = sha256Json(stableClone({ receiving_domain_ref, publication_hash, implementation_binding_hash, mount_policy }));
  if (mount_hash !== expected_mount_hash) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "mount_hash does not preserve exact create_mount identity");
  return Object.freeze({ mount_hash, implementation_binding_hash, resolver_state });
}

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const active_mount = objectValue(request.input.active_mount, "active_mount");
  if (active_mount.status !== "ACTIVE") throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "active mount required");
  const active = mountIdentity(active_mount, "active_mount");
  const rollback_target_mount = objectValue(request.input.rollback_target_mount, "rollback_target_mount");
  if (rollback_target_mount.status !== "INACTIVE") throw new P2StableError("P2_INVALID_INPUT", "rollback target must be an immutable INACTIVE mount record");
  const target = mountIdentity(rollback_target_mount, "rollback_target_mount");
  return success(request, {
    result_kind: "ACTIVE_MOUNT",
    active_mount: Object.freeze({
      ...stableClone(rollback_target_mount) as JsonObject,
      mount_hash: target.mount_hash,
      resolver_state: stableClone(target.resolver_state),
      implementation_binding_hash: target.implementation_binding_hash,
      status: "ACTIVE",
      rolled_back_from_mount_hash: active.mount_hash,
      activation_order: "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST",
    }),
  });
}
