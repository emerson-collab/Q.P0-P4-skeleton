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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/operations/resolve_template_set" as const;
export interface ExactTemplate { readonly template_ref:string; readonly template_hash:string; readonly content:string; readonly tokens?:unknown; }
export interface GovernedAuthorityBinding {
  readonly snapshot_ref_path: string;
  readonly snapshot_hash_path: string;
  readonly exact_ref: string;
  readonly exact_hash: string;
}
export interface GovernedTemplateRecord extends ExactTemplate {
  readonly target_paths: readonly string[];
  readonly authority_bindings: readonly GovernedAuthorityBinding[];
}

/*
 * Q.Template-owned, build-time governed authority. Runtime callers and P2 cannot
 * populate or mutate this set. Concrete template records are implementation
 * artifacts and must be materialized under their own exact Prompt/leaf authority;
 * absent records fail closed rather than falling back to AI/newest/filesystem order.
 */
export const LOCAL_GOVERNED_TEMPLATE_CATALOG: readonly GovernedTemplateRecord[] = Object.freeze([]);

function path_get(root:unknown,path:string):unknown{
  let current:unknown=root;
  for(const part of path.split(".").filter(Boolean)){
    if(current===null || typeof current!=="object" || Array.isArray(current) || !(part in (current as Record<string,unknown>))) return undefined;
    current=(current as Record<string,unknown>)[part];
  }
  return current;
}
function exact_template(value:unknown,path:string):JsonObject{
  const t=as_object(value,"TEMPLATE_PLAN_INPUT_INVALID");
  const ref=as_string(t.template_ref,"TEMPLATE_PLAN_INPUT_INVALID");
  if(ref.includes("${CURRENT}") || !/@V\d{4}(#|$)/.test(ref)) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","Template ref is not exact-versioned",{path});
  const content=as_string(t.content,"TEMPLATE_PLAN_INPUT_INVALID");
  const hash=assert_sha256(t.template_hash,"TEMPLATE_PLAN_INPUT_INVALID");
  if(sha256_text(content)!==hash) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","Template bytes do not match hash",{path});
  return Object.freeze({template_ref:ref,template_hash:hash,content,tokens:stable_clone(t.tokens??{})});
}
function record_matches(record:GovernedTemplateRecord,path:string,snapshot:JsonObject):boolean{
  if(!record.target_paths.map(assert_relative_path).includes(path)) return false;
  for(const binding of record.authority_bindings){
    if(path_get(snapshot,binding.snapshot_ref_path)!==binding.exact_ref) return false;
    if(path_get(snapshot,binding.snapshot_hash_path)!==binding.exact_hash) return false;
  }
  return true;
}
export function resolve_governed_template_from_catalog(path:string,authority_snapshot:JsonObject,catalog:readonly GovernedTemplateRecord[]):JsonObject{
  const normalized=assert_relative_path(path);
  const eligible=catalog.filter(record=>record_matches(record,normalized,authority_snapshot));
  if(eligible.length!==1) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID",eligible.length===0?"No eligible Q.Template-governed exact template":"Multiple eligible Q.Template-governed exact templates",{path:normalized,eligible_count:eligible.length});
  return exact_template(eligible[0],normalized);
}
export function resolve_governed_template(path:string,authority_snapshot:JsonObject):JsonObject{
  return resolve_governed_template_from_catalog(path,authority_snapshot,LOCAL_GOVERNED_TEMPLATE_CATALOG);
}
export async function handler(request:TemplateOperationRequest):Promise<TemplateOperationResponse>{
  const manifest=role(request.input,"EXACT_PHYSICAL_MANIFEST","TEMPLATE_PLAN_INPUT_INVALID");
  if(!Array.isArray(manifest)||manifest.length===0) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","Physical manifest is empty");
  const snapshot=as_object(role(request.input,"EXACT_AUTHORITY_SNAPSHOT","TEMPLATE_AUTHORITY_SNAPSHOT_INVALID"));
  const legacy="GOVERNED_TEMPLATE_AUTHORITY_SET" in request.input ? as_object(request.input.GOVERNED_TEMPLATE_AUTHORITY_SET,"TEMPLATE_PLAN_INPUT_INVALID") : undefined;
  const out:Record<string,unknown>={};
  for(const raw of manifest){
    const path=assert_relative_path(raw);
    const candidate=legacy && path in legacy ? legacy[path] : resolve_governed_template(path,snapshot);
    out[path]=exact_template(candidate,path);
  }
  if(legacy && Object.keys(legacy).some(p=>!(p in out))) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","Legacy template set contains undeclared manifest path");
  return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_TEMPLATE_SET",EXACT_TEMPLATE_SET:Object.freeze(out)}),trace_id:request.trace_id,request_id:request.request_id});
}
