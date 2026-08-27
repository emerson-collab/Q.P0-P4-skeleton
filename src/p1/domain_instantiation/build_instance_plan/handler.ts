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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/operations/build_instance_plan" as const;
export const CHILD_INTERFACE_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@${CURRENT}#/interfaces/build_instance_plan_invoke" as const;
export const P1_INTERNAL_CALL_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/internal_call_invoke" as const;
export interface ResolvedChildAuthority { readonly exact_contract_ref:string; readonly exact_contract_hash:string; }
export type P1InternalCallInvoker=(framework_interface_ref:typeof P1_INTERNAL_CALL_INTERFACE_REF,target_interface_ref:typeof CHILD_INTERFACE_REF,resolved_authority:ResolvedChildAuthority,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
function assert_child(a:ResolvedChildAuthority):void{ if(!/^Q\.TEMPLATE\.CONTRACT\.CAPABILITY\.BUILD_INSTANCE_PLAN@V\d{4}$/.test(a.exact_contract_ref)) throw new TemplateStableError("TEMPLATE_AUTHORITY_SNAPSHOT_INVALID","Child Capability exact Contract ref is unresolved"); assert_sha256(a.exact_contract_hash,"TEMPLATE_AUTHORITY_SNAPSHOT_INVALID"); }
export async function handler(request:TemplateOperationRequest,resolved_child:ResolvedChildAuthority,invoke_internal_call:P1InternalCallInvoker):Promise<TemplateOperationResponse>{
  assert_child(resolved_child); const compiled=as_object(role(request.input,"COMPILED_CONTRACT_REPRESENTATION","TEMPLATE_INVALID_INPUT"));
  const input:Record<string,unknown>={COMPILED_CONTRACT:stable_clone(compiled)};
  for(const key of ["GOVERNED_CURRENT_LOCATOR_STATE","GOVERNED_TEMPLATE_AUTHORITY_SET","EXPLICIT_GOVERNED_BINDING_INPUTS"]){ if(key in request.input) input[key]=stable_clone(request.input[key]); }
  const response=await invoke_internal_call(P1_INTERNAL_CALL_INTERFACE_REF,CHILD_INTERFACE_REF,resolved_child,Object.freeze({input:Object.freeze(input),runtime_context:request.runtime_context,trace_id:request.trace_id,request_id:request.request_id}));
  if(response.outcome_type!=="response" || !("EXACT_INSTANCE_PLAN" in response.runtime_result)) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","Child build_instance_plan did not return EXACT_INSTANCE_PLAN");
  return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_INSTANCE_PLAN",EXACT_INSTANCE_PLAN:stable_clone(response.runtime_result.EXACT_INSTANCE_PLAN)}),trace_id:request.trace_id,request_id:request.request_id});
}
