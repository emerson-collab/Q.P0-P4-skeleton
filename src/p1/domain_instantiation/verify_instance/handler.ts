import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;
export interface RuntimeContextView {
  readonly stage_contract_ref: string;
  readonly operation_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
  readonly invocation_id?: string;
  readonly binding_set_ref?: string;
  readonly attributes?: JsonObject;
}
export interface TemplateOperationRequest {
  readonly input: JsonObject;
  readonly runtime_context: RuntimeContextView;
  readonly trace_id: string;
  readonly request_id: string;
}
export interface TemplateOperationResponse {
  readonly outcome_type: "response";
  readonly runtime_result: JsonObject;
  readonly trace_id: string;
  readonly request_id: string;
}
export class TemplateStableError extends Error {
  readonly code: string;
  readonly details?: JsonObject;
  constructor(code: string, message: string, details?: JsonObject) {
    super(message); this.name = "TemplateStableError"; this.code = code;
    if (details !== undefined) this.details = Object.freeze({ ...details });
  }
}
export function as_object(value: unknown, code = "TEMPLATE_INVALID_INPUT"): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TemplateStableError(code, "Expected object input");
  return value as JsonObject;
}
export function as_string(value: unknown, code = "TEMPLATE_INVALID_INPUT"): string {
  if (typeof value !== "string" || value.length === 0) throw new TemplateStableError(code, "Expected non-empty string input");
  return value;
}
export function stable_clone(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(stable_clone));
  if (value !== null && typeof value === "object") {
    const src=value as Record<string,unknown>; const out:Record<string,unknown>={};
    for (const key of Object.keys(src).sort()) out[key]=stable_clone(src[key]);
    return Object.freeze(out);
  }
  return value;
}
export function canonical_json(value: unknown): string { return JSON.stringify(stable_clone(value)); }
export function sha256_text(value: string): string { return `sha256:${createHash("sha256").update(value,"utf8").digest("hex")}`; }
export function assert_sha256(value: unknown, code="TEMPLATE_INVALID_INPUT"): string {
  const text=as_string(value,code); if(!/^sha256:[0-9a-f]{64}$/.test(text)) throw new TemplateStableError(code,"Expected exact sha256 binding"); return text;
}
export function role(input: JsonObject,key:string,code="TEMPLATE_INVALID_INPUT"): unknown {
  if (!(key in input)) throw new TemplateStableError(code,`Missing required payload role ${key}`); return input[key];
}

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/operations/verify_instance" as const;
export const P1_DEPENDENCY_INVOKE_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/dependency_invoke" as const;
export const LOCAL_DEPENDENCY_REF="q.template.domain_instantiation.repository_readback" as const;
export type P1DependencyInvoker=(framework_interface_ref:typeof P1_DEPENDENCY_INVOKE_INTERFACE_REF,local_dependency_ref:typeof LOCAL_DEPENDENCY_REF,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
function file_hashes(plan:JsonObject):Record<string,string>{ const files=as_object(plan.files,"TEMPLATE_PLAN_INPUT_INVALID"); const out:Record<string,string>={}; for(const path of Object.keys(files).sort()){ const item=as_object(files[path],"TEMPLATE_PLAN_INPUT_INVALID"); out[path]=assert_sha256(item.sha256,"TEMPLATE_PLAN_INPUT_INVALID"); } return out; }
export async function handler(request:TemplateOperationRequest,invoke_dependency:P1DependencyInvoker):Promise<TemplateOperationResponse>{
  const plan=as_object(role(request.input,"EXACT_INSTANCE_PLAN","TEMPLATE_PLAN_INPUT_INVALID"),"TEMPLATE_PLAN_INPUT_INVALID"); const materialized=as_object(role(request.input,"MATERIALIZED_REPOSITORY","TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE"),"TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE");
  const revision=as_string(materialized.resulting_repository_revision,"TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE");
  const response=await invoke_dependency(P1_DEPENDENCY_INVOKE_INTERFACE_REF,LOCAL_DEPENDENCY_REF,Object.freeze({input:Object.freeze({resulting_repository_revision:revision}),runtime_context:request.runtime_context,trace_id:request.trace_id,request_id:request.request_id}));
  if(response.outcome_type!=="response") throw new TemplateStableError("TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE","Repository readback dependency did not return response");
  const readback=as_object(response.runtime_result.EXACT_REPOSITORY_READBACK ?? response.runtime_result.repository_readback ?? response.runtime_result,"TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE");
  if(readback.resulting_repository_revision!==revision) throw new TemplateStableError("TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE","Readback revision does not match materialization receipt");
  const expected=file_hashes(plan); const actual=as_object(readback.file_hashes,"TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE");
  if(canonical_json(expected)!==canonical_json(actual)) throw new TemplateStableError("TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE","Repository file-set/hash closure does not match EXACT_INSTANCE_PLAN");
  const verification_report=Object.freeze({verified:true,resulting_repository_revision:revision,file_count:Object.keys(expected).length,replay_identity_hash:plan.replay_identity_hash,gate_verdict_generated:false,activation_generated:false,publication_generated:false});
  return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"VERIFICATION_REPORT",VERIFICATION_REPORT:verification_report}),trace_id:request.trace_id,request_id:request.request_id});
}
