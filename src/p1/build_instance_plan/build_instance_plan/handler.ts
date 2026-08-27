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

export const CAPABILITY_CONTRACT_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106" as const;
export const P1_INTERNAL_CALL_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/internal_call_invoke" as const;
export const P1_DEPENDENCY_INVOKE_INTERFACE_REF="Q.SS.STD.P1.CONTRACT.BUSINESS_RUNTIME@${CURRENT}#/interfaces/dependency_invoke" as const;
export function assert_relative_path(value:unknown):string{ const path=as_string(value,"TEMPLATE_FORBIDDEN_PATH"); const n=path.replaceAll(String.fromCharCode(92),"/"); if(n.startsWith("/") || /^[A-Za-z]:\//.test(n) || n.split("/").includes("..") || /(^|\/)(module|operations)(\/|$)/i.test(n)) throw new TemplateStableError("TEMPLATE_FORBIDDEN_PATH","Forbidden target path",{path}); if(/<[^>]+>|\{\{[^}]+\}\}|\$\{(?!CURRENT\})[^}]+\}/.test(n)) throw new TemplateStableError("TEMPLATE_UNRESOLVED_VARIABLE","Unresolved target path variable",{path}); return n; }

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/operations/build_instance_plan" as const;
export interface ResolvedSelfAuthority{readonly exact_contract_ref:string;readonly exact_contract_hash:string;}
export type P1InternalCallInvoker=(framework_interface_ref:typeof P1_INTERNAL_CALL_INTERFACE_REF,target_interface_ref:string,resolved_authority:ResolvedSelfAuthority,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
const ORDER=Object.freeze(["resolve_authority_snapshot","resolve_physical_manifest","resolve_template_set","resolve_binding_set","render_file_set","compile_instance_plan"] as const);
const IFACES:Readonly<Record<(typeof ORDER)[number],string>>=Object.freeze(Object.fromEntries(ORDER.map(id=>[id,`Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/interfaces/${id}_invoke`])) as Record<(typeof ORDER)[number],string>);
function exact(r:TemplateOperationResponse,key:string):unknown{ if(r.outcome_type!=="response" || !(key in r.runtime_result)) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID",`Suboperation omitted ${key}`); return r.runtime_result[key]; }
async function call(invoke:P1InternalCallInvoker,self:ResolvedSelfAuthority,id:(typeof ORDER)[number],request:TemplateOperationRequest,input:JsonObject){ return invoke(P1_INTERNAL_CALL_INTERFACE_REF,IFACES[id],self,Object.freeze({input,runtime_context:request.runtime_context,trace_id:request.trace_id,request_id:request.request_id})); }
export async function handler(request:TemplateOperationRequest,resolved_self:ResolvedSelfAuthority,invoke_internal:P1InternalCallInvoker):Promise<TemplateOperationResponse>{ if(resolved_self.exact_contract_ref!==CAPABILITY_CONTRACT_REF) throw new TemplateStableError("TEMPLATE_AUTHORITY_SNAPSHOT_INVALID","BUILD_INSTANCE_PLAN self authority is not V0106"); assert_sha256(resolved_self.exact_contract_hash,"TEMPLATE_AUTHORITY_SNAPSHOT_INVALID"); const compiled=as_object(role(request.input,"COMPILED_CONTRACT","TEMPLATE_BUSINESS_CONTRACT_INVALID")); const authorityInput:Record<string,unknown>={COMPILED_CONTRACT:compiled}; if("GOVERNED_CURRENT_LOCATOR_STATE" in request.input) authorityInput.GOVERNED_CURRENT_LOCATOR_STATE=request.input.GOVERNED_CURRENT_LOCATOR_STATE; const a=await call(invoke_internal,resolved_self,"resolve_authority_snapshot",request,Object.freeze(authorityInput)); const snapshot=exact(a,"EXACT_AUTHORITY_SNAPSHOT"); const p=await call(invoke_internal,resolved_self,"resolve_physical_manifest",request,Object.freeze({COMPILED_CONTRACT:compiled,EXACT_AUTHORITY_SNAPSHOT:snapshot})); const manifest=exact(p,"EXACT_PHYSICAL_MANIFEST"); const ti:Record<string,unknown>={EXACT_PHYSICAL_MANIFEST:manifest,EXACT_AUTHORITY_SNAPSHOT:snapshot}; if("GOVERNED_TEMPLATE_AUTHORITY_SET" in request.input) ti.GOVERNED_TEMPLATE_AUTHORITY_SET=request.input.GOVERNED_TEMPLATE_AUTHORITY_SET; const t=await call(invoke_internal,resolved_self,"resolve_template_set",request,Object.freeze(ti)); const templates=exact(t,"EXACT_TEMPLATE_SET"); const bi:Record<string,unknown>={COMPILED_CONTRACT:compiled,EXACT_PHYSICAL_MANIFEST:manifest,EXACT_TEMPLATE_SET:templates}; if("EXPLICIT_GOVERNED_BINDING_INPUTS" in request.input) bi.EXPLICIT_GOVERNED_BINDING_INPUTS=request.input.EXPLICIT_GOVERNED_BINDING_INPUTS; const b=await call(invoke_internal,resolved_self,"resolve_binding_set",request,Object.freeze(bi)); const bindings=exact(b,"EXACT_BINDING_SET"); const r=await call(invoke_internal,resolved_self,"render_file_set",request,Object.freeze({EXACT_TEMPLATE_SET:templates,EXACT_BINDING_SET:bindings,EXACT_PHYSICAL_MANIFEST:manifest})); const rendered=exact(r,"EXACT_RENDERED_FILE_SET"); const f=await call(invoke_internal,resolved_self,"compile_instance_plan",request,Object.freeze({COMPILED_CONTRACT:compiled,EXACT_AUTHORITY_SNAPSHOT:snapshot,EXACT_PHYSICAL_MANIFEST:manifest,EXACT_TEMPLATE_SET:templates,EXACT_BINDING_SET:bindings,EXACT_RENDERED_FILE_SET:rendered})); const plan=exact(f,"EXACT_INSTANCE_PLAN"); return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_INSTANCE_PLAN",EXACT_INSTANCE_PLAN:stable_clone(plan)}),trace_id:request.trace_id,request_id:request.request_id}); }
export const INTERNAL_SUBOPERATION_ORDER=ORDER;
