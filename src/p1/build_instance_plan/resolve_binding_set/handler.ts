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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/operations/resolve_binding_set" as const;
function path_get(root:unknown,path:string):unknown{ let cur:unknown=root; for(const part of path.split(".")){ if(!cur || typeof cur!=="object" || Array.isArray(cur) || !(part in (cur as Record<string,unknown>))) return undefined; cur=(cur as Record<string,unknown>)[part]; } return cur; }
function token_specs(t:JsonObject):Array<[string,unknown]>{ const tokens=t.tokens??{}; if(Array.isArray(tokens)) return tokens.map(x=>[as_string(x,"TEMPLATE_PLAN_INPUT_INVALID"),{contract_path:as_string(x,"TEMPLATE_PLAN_INPUT_INVALID")}]); const o=as_object(tokens,"TEMPLATE_PLAN_INPUT_INVALID"); return Object.entries(o).sort(([a],[b])=>a.localeCompare(b)); }
export async function handler(request:TemplateOperationRequest):Promise<TemplateOperationResponse>{ const compiled=as_object(role(request.input,"COMPILED_CONTRACT","TEMPLATE_BUSINESS_CONTRACT_INVALID")); role(request.input,"EXACT_PHYSICAL_MANIFEST","TEMPLATE_PLAN_INPUT_INVALID"); const templates=as_object(role(request.input,"EXACT_TEMPLATE_SET","TEMPLATE_PLAN_INPUT_INVALID")); const facts=as_object(compiled.normalized_facts??compiled,"TEMPLATE_BUSINESS_CONTRACT_INVALID"); const legacy="EXPLICIT_GOVERNED_BINDING_INPUTS" in request.input ? as_object(request.input.EXPLICIT_GOVERNED_BINDING_INPUTS,"TEMPLATE_PLAN_INPUT_INVALID") : {}; const declarations=(facts.governed_binding_declarations ?? facts.binding_declarations ?? {}) as unknown; const declared=declarations && typeof declarations==="object" && !Array.isArray(declarations) ? declarations as Record<string,unknown> : {}; const values:Record<string,unknown>={}; for(const path of Object.keys(templates).sort()){ const t=as_object(templates[path],"TEMPLATE_PLAN_INPUT_INVALID"); for(const [token,desc] of token_specs(t)){ if(token in values) continue; const d=desc && typeof desc==="object" && !Array.isArray(desc) ? desc as Record<string,unknown> : {}; const contractPath=typeof d.contract_path==="string"?d.contract_path:token; let value=path_get(facts,contractPath); if(value===undefined){ const bindingKey=typeof d.binding_key==="string"?d.binding_key:token; if(bindingKey in legacy) value=legacy[bindingKey]; else if(bindingKey in declared){ const item=declared[bindingKey]; if(item && typeof item==="object" && !Array.isArray(item) && "value" in (item as Record<string,unknown>)) value=(item as Record<string,unknown>).value; else value=item; } } if(value===undefined) throw new TemplateStableError("TEMPLATE_UNRESOLVED_VARIABLE","Template binding is unresolved",{token}); values[token]=stable_clone(value); } } const exact=Object.freeze({values:Object.freeze(values),binding_hash:sha256_text(canonical_json(values))}); return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_BINDING_SET",EXACT_BINDING_SET:exact}),trace_id:request.trace_id,request_id:request.request_id}); }
