import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;
export interface P2OperationRequest { readonly input: JsonObject; readonly runtime_context: JsonObject; readonly trace_id: string; readonly request_id: string; }
export interface P2OperationResponse { readonly outcome_type: "response"; readonly runtime_result: JsonObject; readonly trace_id: string; readonly request_id: string; }
export class P2StableError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.name = "P2StableError"; this.code = code; } }
function objectValue(value: unknown, field: string): JsonObject { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new P2StableError("P2_INVALID_INPUT", `${field} must be an object`); return value as JsonObject; }
function stringValue(value: unknown, field: string): string { if (typeof value !== "string" || value.length === 0) throw new P2StableError("P2_INVALID_INPUT", `${field} must be a non-empty string`); return value; }
function sha256Value(value: unknown, field: string): string { const text=stringValue(value,field); if(!/^sha256:[0-9a-f]{64}$/.test(text)) throw new P2StableError("P2_INTEGRITY_BINDING_INVALID",`${field} must be an exact sha256 binding`); return text; }
function stableClone(value: unknown): unknown { if(Array.isArray(value)) return Object.freeze(value.map(stableClone)); if(value!==null&&typeof value==="object"){const src=value as Record<string,unknown>;const out:Record<string,unknown>={};for(const k of Object.keys(src).sort()) out[k]=stableClone(src[k]);return Object.freeze(out);} return value; }
function success(request:P2OperationRequest,runtime_result:JsonObject):P2OperationResponse{return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({...runtime_result}),trace_id:request.trace_id,request_id:request.request_id});}

export const STAGE_CONTRACT_REF="Q.SS.STD.P2.CONTRACT.CROSS_DOMAIN_REALIZATION@V0119" as const;
export const ROLE="consumer" as const;
export const CAPABILITY_ID="governed_data_consumption" as const;
export const OPERATION_ID="consume_dynamic_data" as const;
const DATA_CATEGORY="DYNAMIC" as const;
const REPRESENTATION_MODES=Object.freeze(["INLINE_FACT_SET","ARTIFACT_SNAPSHOT","ARTIFACT_CHUNKED_SNAPSHOT"] as const);

function validateMaterialEnvelope(value:unknown):JsonObject{
 const envelope=objectValue(value,"material_envelope");
 stringValue(envelope.material_ref,"material_envelope.material_ref");
 stringValue(envelope.subject_ref,"material_envelope.subject_ref");
 stringValue(envelope.owner_ref,"material_envelope.owner_ref");
 stringValue(envelope.source_ref,"material_envelope.source_ref");
 const representation_mode=stringValue(envelope.representation_mode,"material_envelope.representation_mode");
 if(!(REPRESENTATION_MODES as readonly string[]).includes(representation_mode)) throw new P2StableError("P2_GOVERNED_DATA_REPRESENTATION_INVALID","material envelope representation_mode is invalid");
 sha256Value(envelope.content_hash,"material_envelope.content_hash");
 stringValue(envelope.integrity_profile_ref,"material_envelope.integrity_profile_ref");
 return envelope;
}

export interface GovernedDataConsumptionDependencies{
 consume_governed_data(input:Readonly<{
   data_category:typeof DATA_CATEGORY;
   governed_material_envelope:JsonObject;
   consumer_binding:JsonObject;
 }>):Promise<unknown>;
}

export async function handler(request:P2OperationRequest,dependencies:GovernedDataConsumptionDependencies):Promise<P2OperationResponse>{
 const material_envelope=validateMaterialEnvelope(request.input.material_envelope);
 const consumer_binding=objectValue(request.input.consumer_binding,"consumer_binding");
 const consumption_result=await dependencies.consume_governed_data(Object.freeze({
   data_category:DATA_CATEGORY,
   governed_material_envelope:material_envelope,
   consumer_binding,
 }));
 return success(request,{
   result_kind:"GOVERNED_DATA_CONSUMPTION_BINDING",
   data_consumption_binding:Object.freeze({
     data_category:DATA_CATEGORY,
     material_ref:material_envelope.material_ref,
     subject_ref:material_envelope.subject_ref,
     owner_ref:material_envelope.owner_ref,
     source_ref:material_envelope.source_ref,
     representation_mode:material_envelope.representation_mode,
     content_hash:material_envelope.content_hash,
     integrity_profile_ref:material_envelope.integrity_profile_ref,
     ...(material_envelope.snapshot_ref===undefined?{}:{snapshot_ref:material_envelope.snapshot_ref}),
     ...(material_envelope.manifest_ref===undefined?{}:{manifest_ref:material_envelope.manifest_ref}),
     ...(material_envelope.continuation_token===undefined?{}:{continuation_token:material_envelope.continuation_token}),
     ...(material_envelope.lineage_ref===undefined?{}:{lineage_ref:material_envelope.lineage_ref}),
     ...(material_envelope.metadata===undefined?{}:{metadata:stableClone(material_envelope.metadata)}),
     consumption_result:stableClone(consumption_result),
     full_memory_assembly_required:false,
     creates_evidence_or_gate_result:false,
   }),
 });
}
