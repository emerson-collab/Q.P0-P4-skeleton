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
export const ROLE="provider" as const;
export const CAPABILITY_ID="governed_data_exposure" as const;
export const OPERATION_ID="expose_runtime_data" as const;
const DATA_CATEGORY="RUNTIME" as const;
const REPRESENTATION_MODES=Object.freeze(["INLINE_FACT_SET","ARTIFACT_SNAPSHOT","ARTIFACT_CHUNKED_SNAPSHOT"] as const);

function validateExposureRequest(value:unknown):JsonObject{
 const request=objectValue(value,"authorized_exposure_request");
 stringValue(request.subject_ref,"authorized_exposure_request.subject_ref");
 const requested=stringValue(request.requested_representation,"authorized_exposure_request.requested_representation");
 if(!(REPRESENTATION_MODES as readonly string[]).includes(requested)) throw new P2StableError("P2_GOVERNED_DATA_REPRESENTATION_INVALID","requested_representation is not CURRENT Governed Data Material representation");
 objectValue(request.selection_spec,"authorized_exposure_request.selection_spec");
 return request;
}
function validateMaterialEnvelope(value:unknown,request:JsonObject):JsonObject{
 const envelope=objectValue(value,"material_envelope");
 stringValue(envelope.material_ref,"material_envelope.material_ref");
 const subject_ref=stringValue(envelope.subject_ref,"material_envelope.subject_ref");
 if(subject_ref!==request.subject_ref) throw new P2StableError("P2_GOVERNED_DATA_BINDING_MISMATCH","material envelope subject_ref must match authorized exposure request");
 stringValue(envelope.owner_ref,"material_envelope.owner_ref");
 stringValue(envelope.source_ref,"material_envelope.source_ref");
 const representation_mode=stringValue(envelope.representation_mode,"material_envelope.representation_mode");
 if(!(REPRESENTATION_MODES as readonly string[]).includes(representation_mode)) throw new P2StableError("P2_GOVERNED_DATA_REPRESENTATION_INVALID","material envelope representation_mode is invalid");
 if(representation_mode!==request.requested_representation) throw new P2StableError("P2_GOVERNED_DATA_BINDING_MISMATCH","material envelope representation_mode must match authorized request");
 sha256Value(envelope.content_hash,"material_envelope.content_hash");
 stringValue(envelope.integrity_profile_ref,"material_envelope.integrity_profile_ref");
 return envelope;
}

export interface GovernedDataExposureDependencies {
 materialize_governed_data(input:Readonly<{
   data_category:typeof DATA_CATEGORY;
   authorized_exposure_request:JsonObject;
   exact_source_authority:JsonObject;
   owning_persistence_contract:JsonObject;
   integrity_profile:JsonObject;
   artifact_store_binding:JsonObject;
 }>):Promise<JsonObject>;
}

export async function handler(request:P2OperationRequest,dependencies:GovernedDataExposureDependencies):Promise<P2OperationResponse>{
 if(request.input.reexecution_requested===true) throw new P2StableError("P2_RUNTIME_DATA_REEXECUTION_FORBIDDEN","provider may not re-execute solely to manufacture runtime data");
 const authorized_exposure_request=validateExposureRequest(request.input.authorized_exposure_request);
 const exact_source_authority=objectValue(request.input.exact_source_authority,"exact_source_authority");
 const owning_persistence_contract=objectValue(request.input.owning_persistence_contract,"owning_persistence_contract");
 const integrity_profile=objectValue(request.input.integrity_profile,"integrity_profile");
 const artifact_store_binding=objectValue(request.input.artifact_store_binding,"artifact_store_binding");
 const material_envelope=validateMaterialEnvelope(await dependencies.materialize_governed_data(Object.freeze({
  data_category:DATA_CATEGORY,
  authorized_exposure_request,
  exact_source_authority,
  owning_persistence_contract,
  integrity_profile,
  artifact_store_binding,
 })),authorized_exposure_request);
 return success(request,{result_kind:"GOVERNED_DATA_EXPOSURE",data_category:DATA_CATEGORY,material_envelope:stableClone(material_envelope)});
}
