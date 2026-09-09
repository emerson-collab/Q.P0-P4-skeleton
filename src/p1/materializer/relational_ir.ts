import { createHash } from "node:crypto";

export const DATABASE_PERSISTENCE_CONTRACT_REF = "Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0114" as const;
export const DATABASE_PERSISTENCE_CONTRACT_HASH = "sha256:fb7ecba5efe2431ca521033e9b5d9fa15bcfcef3d0773f755642c7ebfaf8f8b0" as const;
export const PERSISTENCE_COMPILER_PROFILE_REF = "Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0114#/capability_local_schema_compiler_profiles/P1_CAPABILITY_LOCAL_RELATIONAL_V3" as const;
export const PERSISTENCE_COMPILER_PROFILE_HASH = "sha256:724ea3913edcb539d6c73cef453954df39733fc5352434907ea9d506a779e32c" as const;
export const RELATIONAL_IR_REPRESENTATION_VERSION = "P1_RELATIONAL_IR_V1" as const;
export const RELATIONAL_SCHEMA_PLAN_REPRESENTATION_VERSION = "P1_RELATIONAL_SCHEMA_PLAN_V1" as const;
export const CATALOG_FINGERPRINT_PROFILE_ID = "RELATIONAL_CATALOG_FINGERPRINT_V1" as const;

export type SemanticScalarType = "TEXT" | "INTEGER" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME" | "JSON";
export type RelationKind = "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_MANY";

export class MaterializerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "MaterializerError"; this.code = code; }
}

export interface InstancePersistenceBinding { readonly database_instance_ref: string; readonly dialect: "postgresql"; readonly schema_name: string; }
export interface RelationalFieldSemantic { readonly field_ref: string; readonly field_name: string; readonly semantic_type: SemanticScalarType; readonly required: boolean; readonly identity?: boolean; readonly enum_values?: readonly string[]; }
export interface RelationalEntitySemantic { readonly entity_ref: string; readonly owner_capability_ref: string; readonly fields: readonly RelationalFieldSemantic[]; }
export interface RelationalRelationSemantic { readonly relation_ref: string; readonly owner_capability_ref: string; readonly relation_kind: RelationKind; readonly parent_entity_ref?: string; readonly child_entity_ref?: string; readonly left_entity_ref?: string; readonly right_entity_ref?: string; }
export interface RelationalSemanticModel { readonly capability_ref: string; readonly entities: readonly RelationalEntitySemantic[]; readonly relations: readonly RelationalRelationSemantic[]; }
export interface RelationalMaterializerInput { readonly source_contract_ref: string; readonly source_contract_hash: string; readonly instance_persistence_binding: InstancePersistenceBinding; readonly relational_semantics: RelationalSemanticModel; }
export interface RelationalIR { readonly representation_version: typeof RELATIONAL_IR_REPRESENTATION_VERSION; readonly capability_ref: string; readonly entities: readonly RelationalEntitySemantic[]; readonly relations: readonly RelationalRelationSemantic[]; }
export interface RelationalColumnPlan { readonly column_name: string; readonly ordinal_position: number; readonly data_type: string; readonly is_nullable: boolean; readonly framework_owned?: boolean; readonly business_field_ref?: string; readonly primary_key?: boolean; readonly default_value?: string | number; readonly allowed_values?: readonly string[]; }
export interface RelationalForeignKeyPlan { readonly column_name: string; readonly target_table: string; readonly target_column: "q_ref"; readonly unique: boolean; }
export interface RelationalDatabaseObjectPlan { readonly object_ref: string; readonly object_kind: "TABLE"; readonly object_name: string; readonly source_semantic_ref: string; readonly table_kind: "ENTITY" | "RELATION"; readonly columns: readonly RelationalColumnPlan[]; readonly business_identity_columns: readonly string[]; readonly foreign_keys: readonly RelationalForeignKeyPlan[]; readonly unique_constraints: readonly (readonly string[])[]; }
export interface ObjectStatementBinding { readonly source_semantic_ref: string; readonly database_object_ref: string; readonly ordered_ddl_index: number; }
export interface RelationalSchemaPlan {
  readonly representation_version: typeof RELATIONAL_SCHEMA_PLAN_REPRESENTATION_VERSION;
  readonly dialect: "postgresql";
  readonly schema_name: string;
  readonly owner_capability_ref: string;
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly compiler_profile_ref: typeof PERSISTENCE_COMPILER_PROFILE_REF;
  readonly compiler_profile_hash: typeof PERSISTENCE_COMPILER_PROFILE_HASH;
  readonly relational_ir: RelationalIR;
  readonly relational_ir_hash: string;
  readonly database_objects: readonly RelationalDatabaseObjectPlan[];
  readonly ordered_ddl: readonly string[];
  readonly object_statement_bindings: readonly ObjectStatementBinding[];
  readonly catalog_fingerprint_profile: Readonly<{profile_id:typeof CATALOG_FINGERPRINT_PROFILE_ID;projection_tuple_fields:readonly ["schema_name","object_kind","object_name","column_name","ordinal_position","data_type","is_nullable"];rows_sorted_lexicographically_by_tuple_before_hash:true}>;
}

export function stableClone(value: unknown): unknown { if (Array.isArray(value)) return value.map(stableClone); if (value !== null && typeof value === "object") { const out: Record<string, unknown> = {}; for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = stableClone((value as Record<string, unknown>)[key]); return out; } return value; }
export function canonicalJson(value: unknown): string { return JSON.stringify(stableClone(value)); }
export function sha256ExactBytes(bytes: Uint8Array): string { return `sha256:${createHash("sha256").update(bytes).digest("hex")}`; }
export function sha256Canonical(value: unknown): string { return sha256ExactBytes(Buffer.from(canonicalJson(value), "utf8")); }
export function instancePersistenceBindingHash(binding: InstancePersistenceBinding): string { return sha256Canonical({database_instance_ref:binding.database_instance_ref,dialect:binding.dialect,schema_name:binding.schema_name}); }
