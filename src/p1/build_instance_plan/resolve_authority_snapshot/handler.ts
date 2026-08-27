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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/operations/resolve_authority_snapshot" as const;
export const LOCAL_DEPENDENCY_REF="q.template.build_instance_plan.governed_current_authority_material" as const;
export type P1DependencyInvoker=(framework_interface_ref:typeof P1_DEPENDENCY_INVOKE_INTERFACE_REF,local_dependency_ref:typeof LOCAL_DEPENDENCY_REF,request:TemplateOperationRequest)=>Promise<TemplateOperationResponse>;
function validate_snapshot(value:unknown):JsonObject{ const snap=as_object(value,"TEMPLATE_AUTHORITY_SNAPSHOT_INVALID"); if(Object.keys(snap).length===0) throw new TemplateStableError("TEMPLATE_AUTHORITY_SNAPSHOT_INVALID","Authority snapshot is empty"); const visit=(node:unknown,path:string):void=>{ if(typeof node==="string"){ if(node.includes("${CURRENT}")) throw new TemplateStableError("TEMPLATE_AUTHORITY_SNAPSHOT_INVALID","Moving CURRENT remains in exact snapshot",{path}); return;} if(Array.isArray(node)){node.forEach((x,i)=>visit(x,`${path}/${i}`));return;} if(node&&typeof node==="object"){ for(const [k,v] of Object.entries(node as Record<string,unknown>)){ if(k.endsWith("_hash")) assert_sha256(v,"TEMPLATE_AUTHORITY_SNAPSHOT_INVALID"); if(k.endsWith("_ref") && typeof v==="string" && v.includes("@") && !/@V\d{4}(#|$)/.test(v)) throw new TemplateStableError("TEMPLATE_AUTHORITY_SNAPSHOT_INVALID","Authority ref is not exact-versioned",{path:`${path}/${k}`}); visit(v,`${path}/${k}`);} } }; visit(snap,""); return stable_clone(snap) as JsonObject; }
export async function handler(request:TemplateOperationRequest,invoke_dependency:P1DependencyInvoker):Promise<TemplateOperationResponse>{ as_object(role(request.input,"COMPILED_CONTRACT","TEMPLATE_BUSINESS_CONTRACT_INVALID")); let material:unknown; if("GOVERNED_CURRENT_LOCATOR_STATE" in request.input) material=request.input.GOVERNED_CURRENT_LOCATOR_STATE; else { const dep=await invoke_dependency(P1_DEPENDENCY_INVOKE_INTERFACE_REF,LOCAL_DEPENDENCY_REF,Object.freeze({input:Object.freeze({COMPILED_CONTRACT:stable_clone(request.input.COMPILED_CONTRACT)}),runtime_context:request.runtime_context,trace_id:request.trace_id,request_id:request.request_id})); material=dep.runtime_result.EXACT_AUTHORITY_SNAPSHOT ?? dep.runtime_result.Q_STANDARD_SELECTED_ACTIVE_POINTER ?? dep.runtime_result.governed_current_authority_material ?? dep.runtime_result; } const snapshot=validate_snapshot(material); return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_AUTHORITY_SNAPSHOT",EXACT_AUTHORITY_SNAPSHOT:snapshot}),trace_id:request.trace_id,request_id:request.request_id}); }
