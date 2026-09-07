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
export const OPERATION_ID="realize_dependency" as const;
const P1_DEPENDENCY_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@V0175#/interfaces/dependency_invoke" as const;

function validateActiveMount(value:JsonObject):boolean{
 if(value.status!=="ACTIVE") return false;
 stringValue(value.receiving_domain_ref,"verified_binding.receiving_domain_ref");
 sha256Value(value.mount_hash,"verified_binding.mount_hash");
 const resolver_state=objectValue(value.resolver_state,"verified_binding.resolver_state");
 if(resolver_state.verified!==true) throw new P2StableError("P2_RESOLVER_STATE_NOT_VERIFIED","ACTIVE mount resolver_state must be verified");
 const implementation_binding_hash=sha256Value(value.implementation_binding_hash,"verified_binding.implementation_binding_hash");
 if(implementation_binding_hash!==sha256Json(resolver_state)) throw new P2StableError("P2_IMPLEMENTATION_BINDING_HASH_MISMATCH","ACTIVE mount must bind exact canonical resolver_state");
 return true;
}
function validateGovernedDataBinding(value:JsonObject):boolean{
 const category=value.data_category;
 if(category!=="STATIC"&&category!=="DYNAMIC"&&category!=="RUNTIME") return false;
 stringValue(value.source_domain_identity,"verified_binding.source_domain_identity");
 stringValue(value.subject_identity,"verified_binding.subject_identity");
 objectValue(value.source_provenance,"verified_binding.source_provenance");
 stringValue(value.source_fact_authority,"verified_binding.source_fact_authority");
 objectValue(value.governed_access_binding,"verified_binding.governed_access_binding");
 objectValue(value.integrity_binding,"verified_binding.integrity_binding");
 stringValue(value.material_ref,"verified_binding.material_ref");
 sha256Value(value.content_hash,"verified_binding.content_hash");
 if(value.creates_evidence_or_gate_result!==false) throw new P2StableError("P2_GOVERNED_DATA_BINDING_INVALID","governed data binding may not create evidence or gate semantics");
 return true;
}
function validateVerifiedBinding(value:JsonObject):"ACTIVE_MOUNT"|"GOVERNED_DATA_CONSUMPTION_BINDING"{
 if(validateActiveMount(value)) return "ACTIVE_MOUNT";
 if(validateGovernedDataBinding(value)) return "GOVERNED_DATA_CONSUMPTION_BINDING";
 throw new P2StableError("P2_PROVIDER_BINDING_NOT_VERIFIED","only an exact ACTIVE mount or governed-data consumption binding may realize P1 dependency");
}

export async function handler(request:P2OperationRequest):Promise<P2OperationResponse>{
 const verified_provider_binding_or_governed_data_binding=objectValue(request.input.verified_provider_binding_or_governed_data_binding,"verified_provider_binding_or_governed_data_binding");
 const source_binding_kind=validateVerifiedBinding(verified_provider_binding_or_governed_data_binding);
 const receiving_p1_binding=objectValue(request.input.receiving_p1_binding,"receiving_p1_binding");
 const exact_owner_capability_ref=stringValue(receiving_p1_binding.exact_owner_capability_ref,"receiving_p1_binding.exact_owner_capability_ref");
 const exact_receiving_operation_ref=stringValue(receiving_p1_binding.exact_receiving_operation_ref,"receiving_p1_binding.exact_receiving_operation_ref");
 const exact_local_dependency_ref=stringValue(receiving_p1_binding.exact_local_dependency_ref,"receiving_p1_binding.exact_local_dependency_ref");
 if(request.input.create_p1_dependency===true) throw new P2StableError("P2_P1_DEPENDENCY_CREATION_FORBIDDEN","P2.Consumer may only realize an already-declared P1 dependency");
 const payload=stableClone({verified_provider_binding_or_governed_data_binding,exact_owner_capability_ref,exact_receiving_operation_ref,exact_local_dependency_ref,p1_dependency_interface_ref:P1_DEPENDENCY_INTERFACE_REF}) as JsonObject;
 return success(request,{result_kind:"P1_DEPENDENCY_REALIZATION_BINDING",dependency_realization_binding:Object.freeze({...payload,binding_hash:sha256Json(payload),source_binding_kind,creates_or_writes_p1_business_semantics:false})});
}
