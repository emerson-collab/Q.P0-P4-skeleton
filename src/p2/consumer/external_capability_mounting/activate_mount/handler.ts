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
export const OPERATION_ID = "activate_mount" as const;

function resolverIdentity(resolver_state: JsonObject): Readonly<{publication_hash:string; binding_hash:string}> {
  if (resolver_state.verified !== true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED", "mount resolver state must remain verified");
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

function mountIdentity(mount: JsonObject): Readonly<{receiving_domain_ref:string; publication_hash:string; implementation_binding_hash:string; mount_hash:string; resolver_state:JsonObject}> {
  const receiving_domain_ref = stringValue(mount.receiving_domain_ref, "mount.receiving_domain_ref");
  const publication_hash = sha256Value(mount.publication_hash, "mount.publication_hash");
  const verified_publication = objectValue(mount.verified_publication, "mount.verified_publication");
  if (verified_publication.verified !== true) throw new P2StableError("P2_MOUNT_NOT_VERIFIED", "mount publication must remain verified");
  const resolver_state = objectValue(mount.resolver_state, "mount.resolver_state");
  const resolver = resolverIdentity(resolver_state);
  if (resolver.publication_hash !== publication_hash) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "mount publication hash and resolver_state publication hash must match");
  const implementation_binding_hash = sha256Value(mount.implementation_binding_hash, "mount.implementation_binding_hash");
  if (implementation_binding_hash !== sha256Json(resolver_state)) throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "mount must bind the exact canonical resolver_state");
  const mount_policy = optionalObject(mount.mount_policy, "mount.mount_policy") ?? Object.freeze({});
  const mount_hash = sha256Value(mount.mount_hash, "mount.mount_hash");
  const expected_mount_hash = sha256Json(stableClone({ receiving_domain_ref, publication_hash, implementation_binding_hash, mount_policy }));
  if (mount_hash !== expected_mount_hash) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "mount_hash does not preserve exact create_mount identity");
  return Object.freeze({ receiving_domain_ref, publication_hash, implementation_binding_hash, mount_hash, resolver_state });
}

export async function handler(request: P2OperationRequest): Promise<P2OperationResponse> {
  const mount = objectValue(request.input.mount, "mount");
  if (mount.status !== "INACTIVE") throw new P2StableError("P2_INVALID_INPUT", "activate_mount requires an exact INACTIVE retained mount");
  const identity = mountIdentity(mount);
  const current_active_mount = optionalObject(request.input.current_active_mount, "current_active_mount");
  return success(request, {
    result_kind: "ACTIVE_MOUNT",
    active_mount: Object.freeze({
      ...stableClone(mount) as JsonObject,
      mount_hash: identity.mount_hash,
      resolver_state: stableClone(identity.resolver_state),
      implementation_binding_hash: identity.implementation_binding_hash,
      status: "ACTIVE",
      previous_active_mount: stableClone(current_active_mount),
      activation_order: "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST",
    }),
  });
}

export interface OwnerLocalActiveMountPersistencePort {
  read_mount_record(input: Readonly<{ receiving_domain_ref: string; mount_hash: string }>): Promise<JsonObject | undefined>;
  reverify_implementation_material(input: Readonly<{ receiving_domain_ref: string; mount_hash: string; implementation_binding_hash: string; resolver_state: JsonObject }>): Promise<void>;
  read_active_pointer(input: Readonly<{ receiving_domain_ref: string }>): Promise<JsonObject | undefined>;
  switch_active_pointer(input: Readonly<{ receiving_domain_ref: string; mount_hash: string; previous_active_pointer?: JsonObject }>): Promise<void>;
}

function pointerIdentity(pointer: JsonObject): Readonly<{receiving_domain_ref:string; mount_hash:string}> {
  if (pointer.status !== "ACTIVE") throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "active pointer status must be ACTIVE");
  return Object.freeze({
    receiving_domain_ref: stringValue(pointer.receiving_domain_ref, "active_pointer.receiving_domain_ref"),
    mount_hash: sha256Value(pointer.mount_hash, "active_pointer.mount_hash"),
  });
}

export async function commit_active_mount_with_owner(active_mount: JsonObject, persistence: OwnerLocalActiveMountPersistencePort): Promise<void> {
  if (active_mount.status !== "ACTIVE") throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "exact ACTIVE mount required before pointer commit");
  const active = mountIdentity(active_mount);
  const retained = await persistence.read_mount_record(Object.freeze({ receiving_domain_ref: active.receiving_domain_ref, mount_hash: active.mount_hash }));
  if (retained === undefined) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "exact retained owner-local mount record is required");
  if (retained.status !== "INACTIVE") throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "retained owner-local mount record must remain immutable INACTIVE material");
  const retainedIdentity = mountIdentity(retained);
  if (retainedIdentity.receiving_domain_ref !== active.receiving_domain_ref || retainedIdentity.publication_hash !== active.publication_hash || retainedIdentity.implementation_binding_hash !== active.implementation_binding_hash || retainedIdentity.mount_hash !== active.mount_hash) {
    throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "active mount does not match exact retained mount identity");
  }
  if (canonical(retained.verified_publication) !== canonical(active_mount.verified_publication) || canonical(retained.resolver_state) !== canonical(active_mount.resolver_state)) {
    throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "active mount publication/resolver material differs from retained mount");
  }
  await persistence.reverify_implementation_material(Object.freeze({ receiving_domain_ref: active.receiving_domain_ref, mount_hash: active.mount_hash, implementation_binding_hash: active.implementation_binding_hash, resolver_state: stableClone(active.resolver_state) as JsonObject }));
  const previous_active_pointer = await persistence.read_active_pointer(Object.freeze({ receiving_domain_ref: active.receiving_domain_ref }));
  await persistence.switch_active_pointer(Object.freeze({ receiving_domain_ref: active.receiving_domain_ref, mount_hash: active.mount_hash, ...(previous_active_pointer === undefined ? {} : { previous_active_pointer: stableClone(previous_active_pointer) as JsonObject }) }));
  const readback = await persistence.read_active_pointer(Object.freeze({ receiving_domain_ref: active.receiving_domain_ref }));
  if (readback === undefined) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "active pointer read-back is missing");
  const pointer = pointerIdentity(readback);
  if (pointer.receiving_domain_ref !== active.receiving_domain_ref || pointer.mount_hash !== active.mount_hash) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "active pointer does not reference exact activated mount");
}

export async function recover_active_mount_with_owner(receiving_domain_ref: string, persistence: OwnerLocalActiveMountPersistencePort): Promise<JsonObject> {
  const domain_ref = stringValue(receiving_domain_ref, "receiving_domain_ref");
  const pointerValue = await persistence.read_active_pointer(Object.freeze({ receiving_domain_ref: domain_ref }));
  if (pointerValue === undefined) throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "owner-local active pointer is missing");
  const pointer = pointerIdentity(pointerValue);
  if (pointer.receiving_domain_ref !== domain_ref) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "active pointer receiving Domain mismatch");
  const retained = await persistence.read_mount_record(Object.freeze({ receiving_domain_ref: domain_ref, mount_hash: pointer.mount_hash }));
  if (retained === undefined) throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "exact retained mount record is missing");
  if (retained.status !== "INACTIVE") throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "retained mount record must remain immutable INACTIVE material");
  const identity = mountIdentity(retained);
  if (identity.receiving_domain_ref !== domain_ref || identity.mount_hash !== pointer.mount_hash) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", "active pointer and retained mount identity mismatch");
  await persistence.reverify_implementation_material(Object.freeze({ receiving_domain_ref: identity.receiving_domain_ref, mount_hash: identity.mount_hash, implementation_binding_hash: identity.implementation_binding_hash, resolver_state: stableClone(identity.resolver_state) as JsonObject }));
  return Object.freeze({ ...stableClone(retained) as JsonObject, status: "ACTIVE", activation_order: "VERIFY_MATERIAL_THEN_ATOMIC_POINTER_LAST" });
}
