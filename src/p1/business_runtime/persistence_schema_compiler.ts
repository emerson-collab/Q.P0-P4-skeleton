import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;
export const DATABASE_PERSISTENCE_CONTRACT_REF = "Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0113" as const;
export const DATABASE_PERSISTENCE_CONTRACT_HASH = "sha256:64c5d44137c395e8d33f5373cbba5707a4c51befecc3a3d4c055b1ee9e841761" as const;
export const PERSISTENCE_COMPILER_PROFILE_REF = "Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0113#/capability_local_schema_compiler_profiles/P1_CAPABILITY_LOCAL_RELATIONAL_V2" as const;
export const PERSISTENCE_COMPILER_PROFILE_HASH = "sha256:a346fdff9709af9e6d40c739ea0f3fc483cfde44d76168317c8a17af999b890b" as const;
export const PHYSICAL_SCHEMA_REPRESENTATION_VERSION = "CAPABILITY_PHYSICAL_SCHEMA_SPEC_V2" as const;
export const SCHEMA_DEFINITION_REPRESENTATION_VERSION = "CAPABILITY_SCHEMA_DEFINITION_V2" as const;
export const SCHEMA_DEFINITION_ARTIFACT_KIND = "CAPABILITY_SCHEMA_DEFINITION" as const;
export const CATALOG_FINGERPRINT_PROFILE_ID = "RELATIONAL_CATALOG_FINGERPRINT_V1" as const;

export class PersistenceSchemaCompileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "PersistenceSchemaCompileError"; this.code = code; }
}
const obj = (v: unknown, n: string): Record<string, unknown> => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_INPUT_INVALID", `${n} must be an object`);
  return v as Record<string, unknown>;
};
const str = (v: unknown, n: string): string => {
  if (typeof v !== "string" || !v) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_INPUT_INVALID", `${n} must be a non-empty string`);
  return v;
};
const arr = (v: unknown, n: string): readonly unknown[] => {
  if (!Array.isArray(v)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_INPUT_INVALID", `${n} must be an array`);
  return v;
};
const sqlName = (v: unknown, n: string): string => {
  const x = str(v, n); if (!/^[a-z][a-z0-9_]*$/.test(x)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_SQL_NAME_INVALID", `${n} must be lower_snake`); return x;
};
const qid = (x: string) => `"${x.replaceAll('"','""')}"`;
const qlit = (x: string) => `'${x.replaceAll("'","''")}'`;
export function stableClone(v: unknown): unknown {
  if (Array.isArray(v)) return Object.freeze(v.map(stableClone));
  if (v !== null && typeof v === "object") { const out: Record<string, unknown> = {}; for (const k of Object.keys(v as object).sort()) out[k] = stableClone((v as Record<string, unknown>)[k]); return Object.freeze(out); }
  return v;
}
export const canonicalJson = (v: unknown) => JSON.stringify(stableClone(v));
export const sha256ExactBytes = (b: Uint8Array) => `sha256:${createHash("sha256").update(b).digest("hex")}`;
export const sha256CanonicalJson = (v: unknown) => sha256ExactBytes(Buffer.from(canonicalJson(v), "utf8"));

export interface InstancePersistenceBinding { readonly database_instance_ref: string; readonly dialect: "postgresql"; readonly schema_name: string; }
export const instancePersistenceBindingHash = (b: InstancePersistenceBinding) => sha256CanonicalJson({ database_instance_ref:b.database_instance_ref, dialect:b.dialect, schema_name:b.schema_name });
export interface PhysicalColumnSpec { readonly column_name:string; readonly ordinal_position:number; readonly data_type:string; readonly is_nullable:boolean; readonly primary_key?:boolean; readonly default_value?:unknown; readonly allowed_values?:readonly string[]; }
export interface PhysicalDatabaseObjectSpec { readonly object_ref:string; readonly object_kind:"TABLE"; readonly object_name:string; readonly source_business_object_ref:string; readonly columns:readonly PhysicalColumnSpec[]; }
export interface CapabilityPhysicalSchemaSpec {
  readonly representation_version: typeof PHYSICAL_SCHEMA_REPRESENTATION_VERSION; readonly dialect:"postgresql"; readonly schema_name:string;
  readonly owner_capability_ref:string; readonly source_capability_contract_ref:string; readonly source_capability_contract_hash:string;
  readonly compiler_profile_ref: typeof PERSISTENCE_COMPILER_PROFILE_REF; readonly compiler_profile_hash: typeof PERSISTENCE_COMPILER_PROFILE_HASH;
  readonly database_objects:readonly PhysicalDatabaseObjectSpec[]; readonly ordered_ddl:readonly string[];
  readonly object_statement_bindings:readonly Readonly<{source_business_object_ref:string;database_object_ref:string;ordered_ddl_index:number}>[];
  readonly catalog_fingerprint_profile:Readonly<{profile_id:typeof CATALOG_FINGERPRINT_PROFILE_ID; projection_tuple_fields:readonly ["schema_name","object_kind","object_name","column_name","ordinal_position","data_type","is_nullable"]; rows_sorted_lexicographically_by_tuple_before_hash:true}>;
}
export interface CapabilitySchemaDefinitionArtifactPayload {
  readonly representation_version: typeof SCHEMA_DEFINITION_REPRESENTATION_VERSION; readonly source_capability_contract_ref:string; readonly source_capability_contract_hash:string;
  readonly owner_capability_ref:string; readonly instance_persistence_binding:Readonly<InstancePersistenceBinding>; readonly instance_persistence_binding_hash:string;
  readonly compiler_profile_ref:typeof PERSISTENCE_COMPILER_PROFILE_REF; readonly compiler_profile_hash:typeof PERSISTENCE_COMPILER_PROFILE_HASH;
  readonly physical_schema_spec:CapabilityPhysicalSchemaSpec; readonly physical_schema_spec_hash:string; readonly database_object_refs:readonly string[];
}
export interface CapabilitySchemaDefinitionArtifact { readonly artifact_kind:typeof SCHEMA_DEFINITION_ARTIFACT_KIND; readonly artifact_ref:string; readonly content_hash:string; readonly payload:CapabilitySchemaDefinitionArtifactPayload; }
export interface CapabilityPersistenceCompileInput { readonly source_capability_contract_ref:string; readonly source_capability_contract_hash:string; readonly capability_contract:JsonObject; readonly instance_persistence_binding:InstancePersistenceBinding; readonly compiler_profile_ref:typeof PERSISTENCE_COMPILER_PROFILE_REF; readonly compiler_profile_hash:typeof PERSISTENCE_COMPILER_PROFILE_HASH; }

function validateBinding(b: InstancePersistenceBinding): Readonly<InstancePersistenceBinding> {
  const ref = str(b.database_instance_ref,"database_instance_ref");
  if (/^(postgres(?:ql)?:\/\/|https?:\/\/)/i.test(ref) || ref.includes("password=")) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_DATABASE_INSTANCE_IDENTITY_INVALID","database_instance_ref must be provider-neutral identity");
  if (b.dialect !== "postgresql") throw new PersistenceSchemaCompileError("P1_PERSISTENCE_DIALECT_UNSUPPORTED","only postgresql is supported");
  return Object.freeze({database_instance_ref:ref,dialect:"postgresql" as const,schema_name:sqlName(b.schema_name,"schema_name")});
}
function states(c: Record<string,unknown>): readonly string[] {
  if (c.state_model === undefined) return Object.freeze([]); const m=obj(c.state_model,"state_model"); const x=m.allowed_business_states??m.allowed_states??m.states; if(x===undefined)return Object.freeze([]);
  const out=arr(x,"states").map((v,i)=>str(v,`states[${i}]`)); if(new Set(out).size!==out.length) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_STATE_MODEL_INVALID","states must be unique"); return Object.freeze(out);
}
const columns = (s:readonly string[]): readonly PhysicalColumnSpec[] => Object.freeze([
  Object.freeze({column_name:"q_ref",ordinal_position:1,data_type:"text",is_nullable:false,primary_key:true}),
  Object.freeze({column_name:"q_state",ordinal_position:2,data_type:"text",is_nullable:true,...(s.length?{allowed_values:Object.freeze([...s])}:{})}),
  Object.freeze({column_name:"q_revision",ordinal_position:3,data_type:"bigint",is_nullable:false,default_value:1}),
  Object.freeze({column_name:"q_payload",ordinal_position:4,data_type:"jsonb",is_nullable:false}),
  Object.freeze({column_name:"q_created_at",ordinal_position:5,data_type:"timestamptz",is_nullable:false}),
  Object.freeze({column_name:"q_updated_at",ordinal_position:6,data_type:"timestamptz",is_nullable:false}),
]);
function ddl(schema:string, table:string, s:readonly string[]):string {
  const st=s.length?`"q_state" text CHECK ("q_state" IS NULL OR "q_state" IN (${s.map(qlit).join(", ")}))`:`"q_state" text`;
  return `CREATE TABLE IF NOT EXISTS ${qid(schema)}.${qid(table)} ("q_ref" text PRIMARY KEY, ${st}, "q_revision" bigint NOT NULL DEFAULT 1, "q_payload" jsonb NOT NULL, "q_created_at" timestamptz NOT NULL, "q_updated_at" timestamptz NOT NULL);`;
}
export function compileCapabilityPersistenceSchema(input:CapabilityPersistenceCompileInput):CapabilitySchemaDefinitionArtifact {
  if(input.compiler_profile_ref!==PERSISTENCE_COMPILER_PROFILE_REF||input.compiler_profile_hash!==PERSISTENCE_COMPILER_PROFILE_HASH) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_COMPILER_PROFILE_MISMATCH","exact CURRENT V2 compiler profile required");
  if(!/^sha256:[0-9a-f]{64}$/.test(input.source_capability_contract_hash)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_HASH_INVALID","source hash must be sha256");
  const b=validateBinding(input.instance_persistence_binding), c=obj(input.capability_contract,"capability_contract");
  if(`${str(c.q_id,"q_id")}@${str(c.q_version,"q_version")}`!==input.source_capability_contract_ref) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_SOURCE_IDENTITY_MISMATCH","source ref mismatch");
  const id=obj(c.identity,"identity"); if(str(id.capability_contract_ref,"identity.capability_contract_ref")!==input.source_capability_contract_ref) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_SOURCE_IDENTITY_MISMATCH","identity mismatch");
  const owner=str(id.capability_ref,"identity.capability_ref"), p=obj(c.persistence_requirements,"persistence_requirements"); if(p.persistence_required!==true) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_NOT_REQUIRED","Capability does not require persistence");
  const ops=obj(c.operations,"operations"), binds=obj(c.payload_schema_bindings,"payload_schema_bindings"), contracts=obj(c.contracts,"contracts"), refs=new Set(Object.values(contracts).map((v)=>str(obj(v,"contract").contract_ref,"contract_ref")));
  if(!Object.keys(ops).length) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_OPERATION_CLOSURE_INVALID","at least one Operation is required");
  for(const op of Object.keys(ops)){ const x=obj(binds[op],`payload_schema_bindings.${op}`); if(!refs.has(str(x.request_contract_ref,"request_contract_ref"))||!refs.has(str(x.response_contract_ref,"response_contract_ref"))) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_OPERATION_PAYLOAD_CLOSURE_INVALID",`Operation ${op} payload closure invalid`); }
  const owned=arr(obj(c.business_object_ownership,"business_object_ownership").owned_business_objects,"owned_business_objects").map((v,i)=>sqlName(v,`owned_business_objects[${i}]`)); if(!owned.length||new Set(owned).size!==owned.length) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_OBJECT_OWNERSHIP_INVALID","owned_business_objects must be non-empty and unique");
  const ss=states(c), cols=columns(ss), objects:PhysicalDatabaseObjectSpec[]=[], ddls:string[]=[], ob: {source_business_object_ref:string;database_object_ref:string;ordered_ddl_index:number}[]=[];
  owned.forEach((name,i)=>{const ref=`${b.schema_name}.${name}`; objects.push(Object.freeze({object_ref:ref,object_kind:"TABLE",object_name:name,source_business_object_ref:name,columns:cols})); ddls.push(ddl(b.schema_name,name,ss)); ob.push(Object.freeze({source_business_object_ref:name,database_object_ref:ref,ordered_ddl_index:i}));});
  const physical:CapabilityPhysicalSchemaSpec=Object.freeze({representation_version:PHYSICAL_SCHEMA_REPRESENTATION_VERSION,dialect:"postgresql",schema_name:b.schema_name,owner_capability_ref:owner,source_capability_contract_ref:input.source_capability_contract_ref,source_capability_contract_hash:input.source_capability_contract_hash,compiler_profile_ref:PERSISTENCE_COMPILER_PROFILE_REF,compiler_profile_hash:PERSISTENCE_COMPILER_PROFILE_HASH,database_objects:Object.freeze(objects),ordered_ddl:Object.freeze(ddls),object_statement_bindings:Object.freeze(ob),catalog_fingerprint_profile:Object.freeze({profile_id:CATALOG_FINGERPRINT_PROFILE_ID,projection_tuple_fields:Object.freeze(["schema_name","object_kind","object_name","column_name","ordinal_position","data_type","is_nullable"]) as CapabilityPhysicalSchemaSpec["catalog_fingerprint_profile"]["projection_tuple_fields"],rows_sorted_lexicographically_by_tuple_before_hash:true})});
  const payload:CapabilitySchemaDefinitionArtifactPayload=Object.freeze({representation_version:SCHEMA_DEFINITION_REPRESENTATION_VERSION,source_capability_contract_ref:input.source_capability_contract_ref,source_capability_contract_hash:input.source_capability_contract_hash,owner_capability_ref:owner,instance_persistence_binding:b,instance_persistence_binding_hash:instancePersistenceBindingHash(b),compiler_profile_ref:PERSISTENCE_COMPILER_PROFILE_REF,compiler_profile_hash:PERSISTENCE_COMPILER_PROFILE_HASH,physical_schema_spec:physical,physical_schema_spec_hash:sha256CanonicalJson(physical),database_object_refs:Object.freeze(objects.map(x=>x.object_ref))});
  const hash=sha256CanonicalJson(payload); return Object.freeze({artifact_kind:SCHEMA_DEFINITION_ARTIFACT_KIND,artifact_ref:`urn:q:capability-schema-definition:${hash.slice(7)}`,content_hash:hash,payload});
}
