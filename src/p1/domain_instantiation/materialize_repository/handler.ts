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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/operations/materialize_repository" as const;
export const P1_DEPENDENCY_INVOKE_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/dependency_invoke" as const;
export const LOCAL_DEPENDENCY_REF="q.template.domain_instantiation.repository_materialization" as const;
export type P1DependencyInvoker=(framework_interface_ref:typeof P1_DEPENDENCY_INVOKE_INTERFACE_REF,local_dependency_ref:typeof LOCAL_DEPENDENCY_REF,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
export async function handler(request:TemplateOperationRequest,invoke_dependency:P1DependencyInvoker):Promise<TemplateOperationResponse>{
  const plan=as_object(role(request.input,"EXACT_INSTANCE_PLAN","TEMPLATE_PLAN_INPUT_INVALID"),"TEMPLATE_PLAN_INPUT_INVALID");
  const response=await invoke_dependency(P1_DEPENDENCY_INVOKE_INTERFACE_REF,LOCAL_DEPENDENCY_REF,Object.freeze({input:Object.freeze({EXACT_INSTANCE_PLAN:stable_clone(plan)}),runtime_context:request.runtime_context,trace_id:request.trace_id,request_id:request.request_id}));
  if(response.outcome_type!=="response") throw new TemplateStableError("TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE","Repository materialization dependency did not return response");
  const materialized=response.runtime_result.MATERIALIZED_REPOSITORY ?? response.runtime_result.materialized_repository;
  const result=as_object(materialized,"TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE");
  as_string(result.resulting_repository_revision,"TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE");
  return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"MATERIALIZED_REPOSITORY",MATERIALIZED_REPOSITORY:stable_clone(result)}),trace_id:request.trace_id,request_id:request.request_id});
}
