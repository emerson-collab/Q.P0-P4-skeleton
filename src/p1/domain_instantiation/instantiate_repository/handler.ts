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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/operations/instantiate_repository" as const;
export const P1_INTERNAL_CALL_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/internal_call_invoke" as const;
export const P1_DEPENDENCY_INVOKE_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/dependency_invoke" as const;
export const ACTIVATED_CONTRACT_DEPENDENCY_REF="q.template.domain_instantiation.activated_contract_material" as const;
const INTERFACES=Object.freeze({compile_contract:"Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/interfaces/compile_contract_invoke",build_instance_plan:"Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/interfaces/build_instance_plan_invoke",materialize_repository:"Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/interfaces/materialize_repository_invoke",verify_instance:"Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/interfaces/verify_instance_invoke"} as const);
export interface ResolvedSelfAuthority{readonly exact_contract_ref:string;readonly exact_contract_hash:string;}
export type P1InternalCallInvoker=(framework_interface_ref:typeof P1_INTERNAL_CALL_INTERFACE_REF,target_interface_ref:string,resolved_authority:ResolvedSelfAuthority,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
export type P1DependencyInvoker=(framework_interface_ref:typeof P1_DEPENDENCY_INVOKE_INTERFACE_REF,local_dependency_ref:string,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
function exact_result(r:TemplateOperationResponse,key:string):unknown{ if(r.outcome_type!=="response" || !(key in r.runtime_result)) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID",`Internal operation omitted ${key}`); return r.runtime_result[key]; }
async function icall(invoke:P1InternalCallInvoker,self:ResolvedSelfAuthority,iface:string,request:TemplateOperationRequest,input:JsonObject,runtime_context=request.runtime_context){ return invoke(P1_INTERNAL_CALL_INTERFACE_REF,iface,self,Object.freeze({input,runtime_context,trace_id:request.trace_id,request_id:request.request_id})); }
export async function handler(request:TemplateOperationRequest,resolved_self:ResolvedSelfAuthority,invoke_internal:P1InternalCallInvoker,invoke_dependency:P1DependencyInvoker):Promise<TemplateOperationResponse>{
  if(resolved_self.exact_contract_ref!=="Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115") throw new TemplateStableError("TEMPLATE_AUTHORITY_SNAPSHOT_INVALID","DOMAIN_INSTANTIATION self authority is not V0115"); assert_sha256(resolved_self.exact_contract_hash,"TEMPLATE_AUTHORITY_SNAPSHOT_INVALID");
  const target=as_object(role(request.input,"TARGET_REPOSITORY_REQUIREMENT","TEMPLATE_INVALID_INPUT")); let exact_input:unknown;
  if("EXACT_INPUT_CONTRACT" in request.input){ if(request.runtime_context.attributes?.development_test_harness!==true) throw new TemplateStableError("TEMPLATE_INVALID_INPUT","Direct EXACT_INPUT_CONTRACT bypass is restricted to development/legacy harness"); exact_input=request.input.EXACT_INPUT_CONTRACT; }
  else {
    role(request.input,"ACTIVATED_CONTRACT_BINDING","TEMPLATE_INVALID_INPUT");
    const dep=await invoke_dependency(P1_DEPENDENCY_INVOKE_INTERFACE_REF,ACTIVATED_CONTRACT_DEPENDENCY_REF,Object.freeze({input:Object.freeze({ACTIVATED_CONTRACT_BINDING:stable_clone(request.input.ACTIVATED_CONTRACT_BINDING)}),runtime_context:request.runtime_context,trace_id:request.trace_id,request_id:request.request_id}));
    exact_input=dep.runtime_result.EXACT_INPUT_CONTRACT ?? dep.runtime_result.activated_contract_material ?? dep.runtime_result;
  }
  const c=await icall(invoke_internal,resolved_self,INTERFACES.compile_contract,request,Object.freeze({EXACT_INPUT_CONTRACT:stable_clone(exact_input)})); const compiled=exact_result(c,"COMPILED_CONTRACT_REPRESENTATION");
  const p=await icall(invoke_internal,resolved_self,INTERFACES.build_instance_plan,request,Object.freeze({COMPILED_CONTRACT_REPRESENTATION:stable_clone(compiled)})); const plan=exact_result(p,"EXACT_INSTANCE_PLAN");
  const ctx:RuntimeContextView = Object.freeze({...request.runtime_context,attributes:Object.freeze({...request.runtime_context.attributes,target_repository_requirement:stable_clone(target)})});
  const m=await icall(invoke_internal,resolved_self,INTERFACES.materialize_repository,request,Object.freeze({EXACT_INSTANCE_PLAN:stable_clone(plan)}),ctx); const materialized=exact_result(m,"MATERIALIZED_REPOSITORY");
  const v=await icall(invoke_internal,resolved_self,INTERFACES.verify_instance,request,Object.freeze({EXACT_INSTANCE_PLAN:stable_clone(plan),MATERIALIZED_REPOSITORY:stable_clone(materialized)}),ctx); const report=exact_result(v,"VERIFICATION_REPORT");
  const verified_repository_instance=Object.freeze({exact_instance_plan:stable_clone(plan),materialized_repository:stable_clone(materialized),verification_report:stable_clone(report)});
  return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"VERIFIED_REPOSITORY_INSTANCE",VERIFIED_REPOSITORY_INSTANCE:verified_repository_instance}),trace_id:request.trace_id,request_id:request.request_id});
}
