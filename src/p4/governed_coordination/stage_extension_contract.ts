import { createHash } from "node:crypto";

export const P4_CONTRACT_REF = "Q.SS.STD.P4.CONTRACT.COORDINATION@V0141" as const;
export const P4_CONTRACT_HASH = "sha256:afc683394ff10099f5958a1e65b9ff68324a1cacf4c4b97df359123fa0eba49d" as const;
export const P3_CONTRACT_REF = "Q.SS.STD.P3.CONTRACT.EVOLUTION@V0145" as const;
export const P3_CONTRACT_HASH = "sha256:e26f7adb3f0fd32f6ec9dd9e121c74649b1280c261da9f91e83cbb7351a91da4" as const;
export const P4_CAPABILITY_ID = "governed_coordination" as const;
export const P4_OPERATIONS = Object.freeze(["inspect_change_set","approve_activation_plan","resume_recovery","freeze_change_set"] as const);
export type P4OperationId = (typeof P4_OPERATIONS)[number];
export const P4_SAGA_STATES = Object.freeze(["PROPOSED", "IMPACT_READY", "EXECUTING", "CANDIDATES_READY", "VALIDATED", "PLAN_APPROVED", "ACTIVE", "RECOVERY_REQUIRED", "ROLLED_BACK", "FROZEN"] as const);
export type SagaState = (typeof P4_SAGA_STATES)[number];
export const P4_EXECUTION_PHASES = Object.freeze(["CANDIDATE", "TRIAL_ACTIVATION", "EVALUATION_WAIT", "FINAL_ACTIVATION", "COMPENSATION", "ROLLBACK"] as const);
export type ExecutionPhase = (typeof P4_EXECUTION_PHASES)[number];
export const P4_STEP_TYPES = Object.freeze(["REQUEST_CANDIDATE", "TRIAL_ACTIVATION", "EVALUATION_WAIT", "FINAL_ACTIVATION", "ROLLBACK", "COMPENSATION", "READ_RECEIPT"] as const);
export type P4StepType = (typeof P4_STEP_TYPES)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = Readonly<Record<string, JsonValue>>;

export interface P4PathLayer { readonly route_key:string; readonly operation_id:string; readonly trace_id:string; readonly request_id:string; }
export interface P4StaticMountLayer { readonly operation_contract:string; readonly policy_refs:readonly string[]; readonly receipt_contract_ref:string; }
export interface P4Call<I extends JsonObject=JsonObject> extends P4PathLayer,P4StaticMountLayer { readonly input:I; readonly context:JsonObject; }
export interface StableErrorWire { readonly code:string; readonly message:string; readonly category:string; readonly retriable:boolean; readonly trace_id:string; readonly request_id:string; }
export interface RecoveryCursor { readonly execution_phase:ExecutionPhase; readonly step_index:number; readonly target_step_ref:string; readonly last_verified_journal_hash:string; readonly last_provider_receipt_ref:string; }
export interface CoordinationReceipt { readonly coordination_receipt_ref:string; readonly coordination_receipt_hash:string; readonly previous_receipt_hash:string|null; readonly change_set_ref:string; readonly plan_ref:string|null; readonly journal_head_hash:string; readonly provider_receipt_refs:readonly string[]; readonly recorded_at:string; }
export interface P4Response<R extends JsonObject=JsonObject> { readonly outcome_type:"Response"; readonly runtime_result:R; readonly stable_error?:never; readonly execution_receipt:CoordinationReceipt|null; readonly evidence_ref:string|null; readonly trace_id:string; readonly request_id:string; }
export interface P4ErrorResponse { readonly outcome_type:"StableError"; readonly runtime_result?:never; readonly stable_error:StableErrorWire; readonly execution_receipt:CoordinationReceipt|null; readonly evidence_ref:string|null; readonly trace_id:string; readonly request_id:string; }
export type P4Result<R extends JsonObject=JsonObject> = P4Response<R>|P4ErrorResponse;

export class P4Fault extends Error { constructor(readonly code:string,message:string,readonly retriable=false){super(message);this.name="P4Fault";} }
function normalize(value:JsonValue):JsonValue{if(Array.isArray(value))return value.map(normalize) as readonly JsonValue[];if(value!==null&&typeof value==="object"){const src=value as Readonly<Record<string,JsonValue>>;const out:Record<string,JsonValue>={};for(const k of Object.keys(src).sort())out[k]=normalize(src[k]!);return out;}if(typeof value==="number"&&!Number.isFinite(value))throw new P4Fault("P4_INVALID_CANONICAL_JSON","non-finite numbers are forbidden");return value;}
export function canonicalJcs(value:JsonValue):string{return JSON.stringify(normalize(value));}
export function sha256Jcs(value:JsonValue):string{return `sha256:${createHash("sha256").update(canonicalJcs(value),"utf8").digest("hex")}`;}
export function sha256Text(value:string):string{return `sha256:${createHash("sha256").update(value,"utf8").digest("hex")}`;}
export function asObject(value:JsonValue|undefined,field:string):JsonObject{if(value===null||value===undefined||typeof value!=="object"||Array.isArray(value))throw new P4Fault("P4_REQUEST_INVALID",`${field} must be an object`);return value as JsonObject;}
export function asString(value:JsonValue|undefined,field:string):string{if(typeof value!=="string"||value.length===0)throw new P4Fault("P4_REQUEST_INVALID",`${field} must be a non-empty string`);return value;}
export function asInteger(value:JsonValue|undefined,field:string):number{if(typeof value!=="number"||!Number.isSafeInteger(value))throw new P4Fault("P4_REQUEST_INVALID",`${field} must be an integer`);return value;}
export function asStringArray(value:JsonValue|undefined,field:string):readonly string[]{if(!Array.isArray(value)||value.some(v=>typeof v!=="string"||v.length===0))throw new P4Fault("P4_REQUEST_INVALID",`${field} must be a string array`);return value as readonly string[];}
export function requireFields(input:JsonObject,fields:readonly string[],code="P4_REQUEST_INVALID"):void{for(const f of fields)if(!(f in input)||input[f]===null||input[f]==="")throw new P4Fault(code,`missing required field: ${f}`);}
export function response<R extends JsonObject>(call:Pick<P4Call,"trace_id"|"request_id">,runtime_result:R,execution_receipt:CoordinationReceipt|null=null,evidence_ref:string|null=null):P4Response<R>{return Object.freeze({outcome_type:"Response" as const,runtime_result:Object.freeze({...runtime_result}) as R,execution_receipt,evidence_ref,trace_id:call.trace_id,request_id:call.request_id});}
export function stableError(call:Pick<P4Call,"trace_id"|"request_id">,code:string,message:string,retriable=false,receipt:CoordinationReceipt|null=null):P4ErrorResponse{return Object.freeze({outcome_type:"StableError" as const,stable_error:Object.freeze({code,message,category:code,retriable,trace_id:call.trace_id,request_id:call.request_id}),execution_receipt:receipt,evidence_ref:null,trace_id:call.trace_id,request_id:call.request_id});}
export async function failClosed<R extends JsonObject>(call:P4Call,allowedCodes:readonly string[],fn:()=>Promise<P4Response<R>>):Promise<P4Result<R>>{try{return await fn();}catch(error){const fallback=allowedCodes[allowedCodes.length-1]??"P4_FAIL_CLOSED";if(error instanceof P4Fault){const code=allowedCodes.includes(error.code)?error.code:fallback;return stableError(call,code,error.message,error.retriable);}return stableError(call,fallback,error instanceof Error?error.message:"P4 operation failed");}}
export function assertP4Envelope(call:P4Call,operationId:P4OperationId):void{if(call.operation_id!==operationId)throw new P4Fault("P4_REQUEST_INVALID",`operation_id must be ${operationId}`);for(const [v,n] of [[call.route_key,"route_key"],[call.trace_id,"trace_id"],[call.request_id,"request_id"],[call.operation_contract,"operation_contract"],[call.receipt_contract_ref,"receipt_contract_ref"]] as const)asString(v,n);if(!Array.isArray(call.policy_refs))throw new P4Fault("P4_REQUEST_INVALID","policy_refs must be an array");}
export function nowIso():string{return new Date().toISOString();}
export function cloneJson<T extends JsonValue>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
