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

export const OPERATION_REF = "Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/operations/compile_contract" as const;
export const INTERFACE_REF = "Q.TEMPLATE.CONTRACT.CAPABILITY.DOMAIN_INSTANTIATION@V0115#/interfaces/compile_contract_invoke" as const;

type Mutable = Record<string, unknown> | unknown[];
interface MapFrame { readonly node: Record<string,unknown>; readonly mapIndent: number; lastKey?: string; }
interface SeqFrame { readonly node: unknown[]; readonly itemIndent: number; lastIndex?: number; }
type Frame = MapFrame | SeqFrame;
function is_seq_frame(frame:Frame):frame is SeqFrame { return "itemIndent" in frame; }

function scalar(raw:string): unknown {
  const s=raw.trim();
  if (s === "{}") return {};
  if (s === "[]") return [];
  if (s === "true") return true; if (s === "false") return false; if (s === "null" || s === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    if (s[0] === '"') { try { return JSON.parse(s); } catch { /* exact string fallback */ } }
    return s.slice(1,-1).replaceAll("''", "'");
  }
  return s;
}
function mapping_parts(line:string):readonly [string,string] | undefined {
  for (let i=0;i<line.length;i++) {
    if (line[i]!==":") continue;
    const next=line[i+1];
    if (next===undefined || /\s/.test(next)) {
      const key=line.slice(0,i).trim();
      if (key.length===0) return undefined;
      return [key,line.slice(i+1).trim()] as const;
    }
  }
  return undefined;
}
function parse_yaml_subset(text:string): JsonObject {
  const root:Record<string,unknown>={};
  const lines=text.replaceAll("\r\n","\n").split("\n");
  const stack:Frame[]=[{node:root,mapIndent:-1}];
  const next_meaningful=(start:number):{trim:string;indent:number}|undefined=>{
    for(let j=start;j<lines.length;j++){
      const candidate=lines[j]!;
      if(candidate.trim()==="" || candidate.trimStart().startsWith("#")) continue;
      return {trim:candidate.trim(),indent:candidate.length-candidate.trimStart().length};
    }
    return undefined;
  };
  const append_continuation=(frame:Frame,line:string):boolean=>{
    if(is_seq_frame(frame)){
      if(frame.lastIndex===undefined) return false;
      const prior=frame.node[frame.lastIndex];
      if(typeof prior!=="string") return false;
      const joined=`${prior} ${line}`;
      frame.node[frame.lastIndex]=((joined.startsWith("'")&&joined.endsWith("'"))||(joined.startsWith('"')&&joined.endsWith('"'))) ? scalar(joined) : joined;
      return true;
    }
    if(!frame.lastKey) return false;
    const prior=frame.node[frame.lastKey];
    if(typeof prior!=="string") return false;
    const joined=`${prior} ${line}`;
    frame.node[frame.lastKey]=((joined.startsWith("'")&&joined.endsWith("'"))||(joined.startsWith('"')&&joined.endsWith('"'))) ? scalar(joined) : joined;
    return true;
  };

  for(let idx=0;idx<lines.length;idx++){
    const raw=lines[idx]!;
    if(raw.trim()==="" || raw.trimStart().startsWith("#")) continue;
    const indent=raw.length-raw.trimStart().length;
    const line=raw.trim();
    const is_sequence=line==="-" || line.startsWith("- ");

    while(stack.length>1){
      const top=stack[stack.length-1]!;
      if(is_seq_frame(top)){
        if(indent<top.itemIndent || (indent===top.itemIndent && !is_sequence)){ stack.pop(); continue; }
        break;
      }
      if(indent<=top.mapIndent){ stack.pop(); continue; }
      break;
    }
    const frame=stack[stack.length-1]!;

    if(is_sequence){
      if(!is_seq_frame(frame) || indent!==frame.itemIndent) throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID",`Invalid YAML sequence at line ${idx+1}`);
      const body=line.slice(1).trim();
      if(body===""){
        const obj:Record<string,unknown>={}; frame.node.push(obj); frame.lastIndex=frame.node.length-1; stack.push({node:obj,mapIndent:indent}); continue;
      }
      const parts=mapping_parts(body);
      if(parts){
        const [key,value]=parts; const obj:Record<string,unknown>={}; frame.node.push(obj); frame.lastIndex=frame.node.length-1;
        if(value!==""){ obj[key]=scalar(value); stack.push({node:obj,mapIndent:indent,lastKey:key}); continue; }
        const next=next_meaningful(idx+1);
        const sequence_child=next!==undefined && next.indent>=indent && (next.trim==="-" || next.trim.startsWith("- "));
        const child:Mutable=sequence_child?[]:{}; obj[key]=child; stack.push({node:obj,mapIndent:indent,lastKey:key});
        if(Array.isArray(child)) stack.push({node:child,itemIndent:next!.indent}); else stack.push({node:child,mapIndent:indent});
        continue;
      }
      frame.node.push(scalar(body)); frame.lastIndex=frame.node.length-1; continue;
    }

    const parts=mapping_parts(line);
    if(!parts){
      let appended=false;
      for(let s=stack.length-1;s>=0 && !appended;s--) appended=append_continuation(stack[s]!,line);
      if(appended) continue;
      throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID",`Invalid YAML continuation at line ${idx+1}`);
    }
    if(is_seq_frame(frame)) throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID",`Invalid YAML map placement at line ${idx+1}`);
    const [key,value]=parts;
    if(value!==""){ frame.node[key]=scalar(value); frame.lastKey=key; continue; }
    const next=next_meaningful(idx+1);
    const sequence_child=next!==undefined && next.indent>=indent && (next.trim==="-" || next.trim.startsWith("- "));
    const child:Mutable=sequence_child?[]:{}; frame.node[key]=child; frame.lastKey=key;
    if(Array.isArray(child)) stack.push({node:child,itemIndent:next!.indent}); else stack.push({node:child,mapIndent:indent});
  }
  return root;
}
function selected_active(value:unknown): boolean {
  if (value === "Q_STANDARD_SELECTED_ACTIVE_POINTER") return true;
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const o=value as Record<string,unknown>;
    return (o.selected_state === "Q_STANDARD_SELECTED_ACTIVE_POINTER" || o.state === "Q_STANDARD_SELECTED_ACTIVE_POINTER") && o.active !== false;
  }
  return false;
}
export async function handler(request:TemplateOperationRequest):Promise<TemplateOperationResponse>{
  const material=as_object(role(request.input,"EXACT_INPUT_CONTRACT","TEMPLATE_BUSINESS_CONTRACT_INVALID"),"TEMPLATE_BUSINESS_CONTRACT_INVALID");
  const source_contract_ref=as_string(material.exact_source_contract_ref,"TEMPLATE_BUSINESS_CONTRACT_INVALID");
  const source_contract_hash=assert_sha256(material.exact_source_contract_hash,"TEMPLATE_BUSINESS_CONTRACT_INVALID");
  const exact_source_contract_bytes=as_string(material.exact_source_contract_bytes,"TEMPLATE_BUSINESS_CONTRACT_INVALID");
  if (sha256_text(exact_source_contract_bytes)!==source_contract_hash) throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID","Exact source Contract bytes do not match integrity binding");
  if (!("source_provenance" in material) || material.source_provenance===null || material.source_provenance==="") throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID","Source provenance is unresolved");
  if (!selected_active(material.selected_active_state_binding)) throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID","Selected-active binding is not proven");
  let normalized_facts:JsonObject;
  try { normalized_facts=exact_source_contract_bytes.trimStart().startsWith("{") ? as_object(JSON.parse(exact_source_contract_bytes),"TEMPLATE_BUSINESS_CONTRACT_INVALID") : parse_yaml_subset(exact_source_contract_bytes); }
  catch(error){ if(error instanceof TemplateStableError) throw error; throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID","Exact source Contract is not valid supported machine-readable JSON/YAML"); }
  const q_id=as_string(normalized_facts.q_id,"TEMPLATE_BUSINESS_CONTRACT_INVALID"); const q_version=as_string(normalized_facts.q_version,"TEMPLATE_BUSINESS_CONTRACT_INVALID");
  if (`${q_id}@${q_version}`!==source_contract_ref) throw new TemplateStableError("TEMPLATE_BUSINESS_CONTRACT_INVALID","Contract q_id/q_version do not match exact source ref");
  const compiled_contract=Object.freeze({source_contract_ref,source_contract_hash,exact_source_contract_bytes,source_provenance:stable_clone(material.source_provenance),selected_active_state_binding:stable_clone(material.selected_active_state_binding),normalized_facts:stable_clone(normalized_facts),normalized_fact_hash:sha256_text(canonical_json(normalized_facts))});
  return Object.freeze({outcome_type:"response" as const,runtime_result:Object.freeze({result_kind:"COMPILED_CONTRACT_REPRESENTATION",COMPILED_CONTRACT_REPRESENTATION:compiled_contract}),trace_id:request.trace_id,request_id:request.request_id});
}
