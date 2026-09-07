import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;
export interface P2OperationRequest { readonly input: JsonObject; readonly runtime_context: JsonObject; readonly trace_id: string; readonly request_id: string; }
export interface P2OperationResponse { readonly outcome_type: "response"; readonly runtime_result: JsonObject; readonly trace_id: string; readonly request_id: string; }
export class P2StableError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.name = "P2StableError"; this.code = code; } }
function objectValue(value: unknown, field: string): JsonObject { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new P2StableError("P2_INVALID_INPUT", `${field} must be an object`); return value as JsonObject; }
function stringValue(value: unknown, field: string): string { if (typeof value !== "string" || value.length === 0) throw new P2StableError("P2_INVALID_INPUT", `${field} must be a non-empty string`); return value; }
function sha256Value(value: unknown, field: string): string { const text = stringValue(value, field); if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID", `${field} must be an exact sha256 binding`); return text; }
function stableClone(value: unknown): unknown { if (Array.isArray(value)) return Object.freeze(value.map(stableClone)); if (value !== null && typeof value === "object") { const source = value as Record<string, unknown>; const out: Record<string, unknown> = {}; for (const key of Object.keys(source).sort()) out[key] = stableClone(source[key]); return Object.freeze(out); } return value; }
function canonical(value: unknown): string { return JSON.stringify(stableClone(value)); }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`; }
function success(request: P2OperationRequest, runtime_result: JsonObject): P2OperationResponse { return Object.freeze({ outcome_type: "response" as const, runtime_result: Object.freeze({ ...runtime_result }), trace_id: request.trace_id, request_id: request.request_id }); }

export const STAGE_CONTRACT_REF = "Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0119" as const;
export const ROLE = "consumer" as const;
export const CAPABILITY_ID = "external_capability_mounting" as const;
export const OPERATION_ID = "execute_mounted_capability" as const;
const RUNTIME_CONTRACT_REF = "Q.SS.STD.P0.CONTRACT.RUNTIME_CORE@V0134" as const;

function validateResolverState(resolver_state: JsonObject): void {
  if (resolver_state.verified !== true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED", "verified resolver state required");
  const publication_hash = sha256Value(resolver_state.publication_hash, "active_mount.resolver_state.publication_hash");
  const implementation_artifact_ref = stringValue(resolver_state.implementation_artifact_ref, "active_mount.resolver_state.implementation_artifact_ref");
  const implementation_artifact_hash = sha256Value(resolver_state.implementation_artifact_hash, "active_mount.resolver_state.implementation_artifact_hash");
  const entry_symbol_ref = stringValue(resolver_state.entry_symbol_ref, "active_mount.resolver_state.entry_symbol_ref");
  const local_material_binding_ref = stringValue(resolver_state.local_material_binding_ref, "active_mount.resolver_state.local_material_binding_ref");
  const binding_hash = sha256Value(resolver_state.binding_hash, "active_mount.resolver_state.binding_hash");
  const expected = sha256Json({ publication_hash, implementation_artifact_ref, implementation_artifact_hash, entry_symbol_ref, local_material_binding_ref });
  if (binding_hash !== expected) throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "resolver_state.binding_hash does not match exact resolved implementation material");
}

export interface MountedCapabilityExecutionDependencies {
  invoke_local_p0(input: Readonly<{
    readonly exact_interface_binding: JsonObject;
    readonly implementation_binding: JsonObject;
    readonly operation_input: unknown;
    readonly runtime_context: JsonObject;
    readonly trace_id: string;
    readonly request_id: string;
  }>): Promise<unknown>;
}

export async function handler(request: P2OperationRequest, dependencies: MountedCapabilityExecutionDependencies): Promise<P2OperationResponse> {
  const active_mount = objectValue(request.input.active_mount, "active_mount");
  if (active_mount.status !== "ACTIVE") throw new P2StableError("P2_MOUNT_NOT_ACTIVE", "active mount required");
  const active_mount_hash = sha256Value(active_mount.mount_hash, "active_mount.mount_hash");
  const resolver_state = objectValue(active_mount.resolver_state, "active_mount.resolver_state");
  validateResolverState(resolver_state);
  const implementation_binding_hash = sha256Json(resolver_state);
  if (active_mount.implementation_binding_hash !== undefined) {
    const mounted_hash = sha256Value(active_mount.implementation_binding_hash, "active_mount.implementation_binding_hash");
    if (mounted_hash !== implementation_binding_hash) throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH", "active mount and resolver_state implementation binding hash mismatch");
  }
  const exact_interface_binding = objectValue(request.input.exact_interface_binding, "exact_interface_binding");
  for (const forbidden of ["translation", "mapping", "wrapper", "second_protocol"]) {
    if (exact_interface_binding[forbidden] === true) throw new P2StableError("P2_PROTOCOL_TRANSLATION_FORBIDDEN", "exact Q Interface semantics must be preserved");
  }
  const exact_interface_ref = stringValue(exact_interface_binding.interface_ref, "exact_interface_binding.interface_ref");
  const interface_binding_hash = sha256Json(exact_interface_binding);
  const operation_input = request.input.operation_input;
  const runtime_result = await dependencies.invoke_local_p0({
    exact_interface_binding,
    implementation_binding: stableClone(resolver_state) as JsonObject,
    operation_input,
    runtime_context: request.runtime_context,
    trace_id: request.trace_id,
    request_id: request.request_id,
  });
  const runtime_result_hash = sha256Json(runtime_result);
  const receipt_payload = Object.freeze({
    stage_contract_ref: STAGE_CONTRACT_REF,
    role: ROLE,
    capability_id: CAPABILITY_ID,
    operation_id: OPERATION_ID,
    active_mount_hash,
    exact_interface_ref,
    interface_binding_hash,
    implementation_binding_hash,
    runtime_contract_ref: RUNTIME_CONTRACT_REF,
    trace_id: request.trace_id,
    request_id: request.request_id,
    outcome_type: "response" as const,
    runtime_result_hash,
    second_runtime_used: false,
  });
  const receipt_hash = sha256Json(receipt_payload);
  const execution_receipt = Object.freeze({
    receipt_ref: `urn:q:p2:execution-receipt:${receipt_hash.slice("sha256:".length)}`,
    receipt_hash,
    receipt_payload,
  });
  return success(request, {
    result_kind: "MOUNTED_CAPABILITY_EXECUTION",
    mounted_execution: Object.freeze({
      runtime_contract_ref: RUNTIME_CONTRACT_REF,
      exact_interface_binding: stableClone(exact_interface_binding),
      interface_binding_hash,
      implementation_binding_hash,
      runtime_result: stableClone(runtime_result),
      second_runtime_used: false,
    }),
    execution_receipt,
  });
}
