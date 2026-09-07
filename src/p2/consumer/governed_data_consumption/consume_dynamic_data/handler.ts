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
 const envelope=objectValue(value,"governed_data_material.material_envelope");
 stringValue(envelope.material_ref,"governed_data_material.material_envelope.material_ref");
 stringValue(envelope.subject_ref,"governed_data_material.material_envelope.subject_ref");
 stringValue(envelope.owner_ref,"governed_data_material.material_envelope.owner_ref");
 stringValue(envelope.source_ref,"governed_data_material.material_envelope.source_ref");
 const representation_mode=stringValue(envelope.representation_mode,"governed_data_material.material_envelope.representation_mode");
 if(!(REPRESENTATION_MODES as readonly string[]).includes(representation_mode)) throw new P2StableError("P2_GOVERNED_DATA_REPRESENTATION_INVALID","material envelope representation_mode is invalid");
 sha256Value(envelope.content_hash,"governed_data_material.material_envelope.content_hash");
 stringValue(envelope.integrity_profile_ref,"governed_data_material.material_envelope.integrity_profile_ref");
 return envelope;
}

export interface GovernedDataConsumptionDependencies{consume_governed_data(input:Readonly<{data_category:typeof DATA_CATEGORY;governed_material_envelope:JsonObject;consumer_binding:JsonObject;artifact_store_resolver:JsonObject}>):Promise<unknown>;}

export async function handler(request:P2OperationRequest,dependencies:GovernedDataConsumptionDependencies):Promise<P2OperationResponse>{
 const governed_data_material=objectValue(request.input.governed_data_material,"governed_data_material");
 if(governed_data_material.data_category!==DATA_CATEGORY) throw new P2StableError("P2_DATA_CATEGORY_MISMATCH",`expected ${DATA_CATEGORY} governed data`);
 const source_domain_identity=stringValue(governed_data_material.source_domain_identity,"governed_data_material.source_domain_identity");
 const subject_identity=stringValue(governed_data_material.subject_identity,"governed_data_material.subject_identity");
 const source_provenance=objectValue(governed_data_material.source_provenance,"governed_data_material.source_provenance");
 const source_fact_authority=stringValue(governed_data_material.source_fact_authority,"governed_data_material.source_fact_authority");
 const governed_access_binding=objectValue(governed_data_material.governed_access_binding,"governed_data_material.governed_access_binding");
 const integrity_binding=objectValue(governed_data_material.integrity_binding,"governed_data_material.integrity_binding");
 const material_envelope=validateMaterialEnvelope(governed_data_material.material_envelope);
 const consumer_binding=objectValue(request.input.consumer_binding,"consumer_binding");
 const artifact_store_resolver=objectValue(request.input.artifact_store_resolver,"artifact_store_resolver");
 const consumption_result=await dependencies.consume_governed_data(Object.freeze({data_category:DATA_CATEGORY,governed_material_envelope:material_envelope,consumer_binding,artifact_store_resolver}));
 return success(request,{result_kind:"GOVERNED_DATA_CONSUMPTION_BINDING",data_consumption_binding:Object.freeze({data_category:DATA_CATEGORY,source_domain_identity,subject_identity,source_provenance:stableClone(source_provenance),source_fact_authority,governed_access_binding:stableClone(governed_access_binding),integrity_binding:stableClone(integrity_binding),material_ref:material_envelope.material_ref,subject_ref:material_envelope.subject_ref,owner_ref:material_envelope.owner_ref,source_ref:material_envelope.source_ref,representation_mode:material_envelope.representation_mode,content_hash:material_envelope.content_hash,integrity_profile_ref:material_envelope.integrity_profile_ref,...(material_envelope.snapshot_ref===undefined?{}:{snapshot_ref:material_envelope.snapshot_ref}),...(material_envelope.manifest_ref===undefined?{}:{manifest_ref:material_envelope.manifest_ref}),...(material_envelope.continuation_token===undefined?{}:{continuation_token:material_envelope.continuation_token}),...(material_envelope.lineage_ref===undefined?{}:{lineage_ref:material_envelope.lineage_ref}),...(material_envelope.metadata===undefined?{}:{metadata:stableClone(material_envelope.metadata)}),consumption_result:stableClone(consumption_result),full_memory_assembly_required:false,creates_evidence_or_gate_result:false})});
}
