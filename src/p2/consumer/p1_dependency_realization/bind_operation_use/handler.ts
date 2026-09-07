import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;
export interface P2OperationRequest { readonly input: JsonObject; readonly runtime_context: JsonObject; readonly trace_id: string; readonly request_id: string; }
export interface P2OperationResponse { readonly outcome_type: "response"; readonly runtime_result: JsonObject; readonly trace_id: string; readonly request_id: string; }
export class P2StableError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.name = "P2StableError"; this.code = code; } }
function objectValue(value: unknown, field: string): JsonObject { if(value===null||typeof value!=="object"||Array.isArray(value)) throw new P2StableError("P2_INVALID_INPUT",`${field} must be an object`); return value as JsonObject; }
function stringValue(value: unknown, field: string): string { if(typeof value!=="string"||value.length===0) throw new P2StableError("P2_INVALID_INPUT",`${field} must be a non-empty string`); return value; }
function sha256Value(value: unknown, field: string): string { const text=stringValue(value,field); if(!/^sha256:[0-9a-f]{64}$/.test(text)) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID",`${field} must be an exact sha256 binding`); return text; }
function stableClone(value: unknown): unknown { if(Array.isArray(value)) return Object.freeze(value.map(stableClone)); if(value!==null&&typeof value==="object"){const src=value as Record<string,unknown>;const out:Record<string,unknown>={};for(const k of Object.keys(src).sort()) out[k]=stableClone(src[k]);return Object.freeze(out);} return value; }
function canonical(value: unknown): string { return JSON.stringify(stableClone(value)); }
function sha256Json(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value),"utf8").digest("hex")}`; }
function success(request:P2OperationRequest,runtime_result:JsonObject):P2OperationResponse{return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({...runtime_result}),trace_id:request.trace_id,request_id:request.request_id});}

export const STAGE_CONTRACT_REF="Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0119" as const;
export const ROLE="consumer" as const;
export const CAPABILITY_ID="p1_dependency_realization" as const;
export const OPERATION_ID="bind_operation_use" as const;

function verifyRealizationBinding(binding:JsonObject):string{
 const binding_hash=sha256Value(binding.binding_hash,"dependency_realization_binding.binding_hash");
 if(binding.creates_or_writes_p1_business_semantics!==false) throw new P2StableError("P2_P1_DEPENDENCY_CREATION_FORBIDDEN","dependency realization must not write P1 business semantics");
 const verified_provider_binding_or_governed_data_binding=objectValue(binding.verified_provider_binding_or_governed_data_binding,"dependency_realization_binding.verified_provider_binding_or_governed_data_binding");
 const exact_owner_capability_ref=stringValue(binding.exact_owner_capability_ref,"dependency_realization_binding.exact_owner_capability_ref");
 const exact_receiving_operation_ref=stringValue(binding.exact_receiving_operation_ref,"dependency_realization_binding.exact_receiving_operation_ref");
 const exact_local_dependency_ref=stringValue(binding.exact_local_dependency_ref,"dependency_realization_binding.exact_local_dependency_ref");
 const p1_dependency_interface_ref=stringValue(binding.p1_dependency_interface_ref,"dependency_realization_binding.p1_dependency_interface_ref");
 const payload={verified_provider_binding_or_governed_data_binding,exact_owner_capability_ref,exact_receiving_operation_ref,exact_local_dependency_ref,p1_dependency_interface_ref};
 if(binding_hash!==sha256Json(payload)) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID","dependency realization binding_hash does not match exact canonical binding");
 return binding_hash;
}

export async function handler(request:P2OperationRequest):Promise<P2OperationResponse>{
 const dependency_realization_binding=objectValue(request.input.dependency_realization_binding,"dependency_realization_binding");
 const binding_hash=verifyRealizationBinding(dependency_realization_binding);
 const operation_use=objectValue(request.input.operation_use,"operation_use");
 const exact_receiving_operation_ref=stringValue(operation_use.exact_receiving_operation_ref,"operation_use.exact_receiving_operation_ref");
 const exact_local_dependency_ref=stringValue(operation_use.exact_local_dependency_ref,"operation_use.exact_local_dependency_ref");
 if(dependency_realization_binding.exact_receiving_operation_ref!==exact_receiving_operation_ref||dependency_realization_binding.exact_local_dependency_ref!==exact_local_dependency_ref) throw new P2StableError("P2_OPERATION_USE_BINDING_MISMATCH","operation use must match the exact predeclared P1 dependency realization");
 const payload=stableClone({binding_hash,exact_receiving_operation_ref,exact_local_dependency_ref,dependency_realization_binding}) as JsonObject;
 return success(request,{result_kind:"P1_OPERATION_USE_BINDING",operation_use_binding:Object.freeze({...payload,operation_use_binding_hash:sha256Json(payload),provider_capability_reowned:false,p1_business_semantics_written:false})});
}
