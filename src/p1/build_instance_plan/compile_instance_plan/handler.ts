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

export const OPERATION_REF="Q.TEMPLATE.CONTRACT.CAPABILITY.BUILD_INSTANCE_PLAN@V0106#/operations/compile_instance_plan" as const;
export async function handler(request:TemplateOperationRequest):Promise<TemplateOperationResponse>{ const compiled=as_object(role(request.input,"COMPILED_CONTRACT","TEMPLATE_BUSINESS_CONTRACT_INVALID")); const ref=as_string(compiled.source_contract_ref,"TEMPLATE_BUSINESS_CONTRACT_INVALID"); const hash=assert_sha256(compiled.source_contract_hash,"TEMPLATE_BUSINESS_CONTRACT_INVALID"); const snapshot=as_object(role(request.input,"EXACT_AUTHORITY_SNAPSHOT","TEMPLATE_AUTHORITY_SNAPSHOT_INVALID")); const manifest=role(request.input,"EXACT_PHYSICAL_MANIFEST","TEMPLATE_PLAN_INPUT_INVALID"); if(!Array.isArray(manifest)) throw new TemplateStableError("TEMPLATE_PLAN_INPUT_INVALID","Manifest must be array"); const templates=as_object(role(request.input,"EXACT_TEMPLATE_SET","TEMPLATE_PLAN_INPUT_INVALID")); const bindings=as_object(role(request.input,"EXACT_BINDING_SET","TEMPLATE_PLAN_INPUT_INVALID")); const rendered=as_object(role(request.input,"EXACT_RENDERED_FILE_SET","TEMPLATE_PLAN_INPUT_INVALID")); const paths=manifest.map(assert_relative_path).sort(); if(canonical_json(paths)!==canonical_json(Object.keys(rendered).sort())) throw new TemplateStableError("TEMPLATE_GENERATED_HASH_CLOSURE_FAILURE","Rendered file set differs from physical manifest"); const binding_hash=typeof bindings.binding_hash==="string"?assert_sha256(bindings.binding_hash,"TEMPLATE_PLAN_INPUT_INVALID"):sha256_text(canonical_json(bindings)); const files:Record<string,unknown>={}; for(const path of paths){ const content=as_string(rendered[path],"TEMPLATE_PLAN_INPUT_INVALID"); const t=as_object(templates[path],"TEMPLATE_PLAN_INPUT_INVALID"); files[path]=Object.freeze({content,sha256:sha256_text(content),template_ref:as_string(t.template_ref,"TEMPLATE_PLAN_INPUT_INVALID"),template_hash:assert_sha256(t.template_hash,"TEMPLATE_PLAN_INPUT_INVALID"),binding_hash}); } const physical_manifest_hash=sha256_text(canonical_json(paths)); const template_input_hash=sha256_text(canonical_json(templates)); const replay_identity_hash=sha256_text(canonical_json({source_contract_ref:ref,source_contract_hash:hash,authority_snapshot:snapshot,physical_manifest_hash,template_input_hash,binding_hash,capability_ref:"Q.TEMPLATE.CAPABILITY.BUILD_INSTANCE_PLAN@V0106"})); const plan=Object.freeze({source_contract_ref:ref,source_contract_hash:hash,authority_snapshot:stable_clone(snapshot),physical_manifest_hash,template_input_hash,binding_input_hash:binding_hash,files:Object.freeze(files),replay_identity_hash}); return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"EXACT_INSTANCE_PLAN",EXACT_INSTANCE_PLAN:plan}),trace_id:request.trace_id,request_id:request.request_id}); }
