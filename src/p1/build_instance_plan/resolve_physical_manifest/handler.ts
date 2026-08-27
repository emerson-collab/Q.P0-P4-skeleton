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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/operations/resolve_physical_manifest" as const;
function collect_file_values(node:unknown,out:Set<string>):void{
  if(typeof node==="string"){ out.add(assert_relative_path(node)); return; }
  if(Array.isArray(node)){ for(const value of node) collect_file_values(value,out); return; }
  if(node && typeof node==="object") for(const value of Object.values(node as Record<string,unknown>)) collect_file_values(value,out);
}
function collect(node:unknown,out:Set<string>):void{
  if(Array.isArray(node)){ for(const value of node) collect(value,out); return; }
  if(!node || typeof node!=="object") return;
  for(const [key,value] of Object.entries(node as Record<string,unknown>)){
    if(key.endsWith("_file") && typeof value==="string") out.add(assert_relative_path(value));
    else if(key.endsWith("_files") || key==="required_files" || key==="fixed_files" || key==="paths") collect_file_values(value,out);
    else if(typeof value==="object") collect(value,out);
  }
}
export async function handler(request:TemplateOperationRequest):Promise<TemplateOperationResponse>{ const compiled=as_object(role(request.input,"COMPILED_CONTRACT","TEMPLATE_BUSINESS_CONTRACT_INVALID")); const snapshot=as_object(role(request.input,"EXACT_AUTHORITY_SNAPSHOT","TEMPLATE_AUTHORITY_SNAPSHOT_INVALID")); const facts=as_object(compiled.normalized_facts??compiled,"TEMPLATE_BUSINESS_CONTRACT_INVALID"); const out=new Set<string>(); if("physical_model" in facts) collect(facts.physical_model,out); collect(snapshot,out); if(out.size===0) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","No exact Contract/Stage physical paths resolved"); const manifest=Object.freeze([...out].sort()); return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_PHYSICAL_MANIFEST",EXACT_PHYSICAL_MANIFEST:manifest}),trace_id:request.trace_id,request_id:request.request_id}); }
