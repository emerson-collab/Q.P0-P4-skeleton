import { createHash } from "node:crypto";

export type SemanticScalarType = "TEXT" | "INTEGER" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME" | "JSON";
export type RelationKind = "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_MANY";

export class MaterializerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "MaterializerError"; this.code = code; }
}

export interface RelationalFieldSemantic { readonly field_ref: string; readonly field_name: string; readonly semantic_type: SemanticScalarType; readonly required: boolean; readonly identity?: boolean; readonly enum_values?: readonly string[]; }
export interface RelationalEntitySemantic { readonly entity_ref: string; readonly owner_capability_ref: string; readonly fields: readonly RelationalFieldSemantic[]; }
export interface RelationalRelationSemantic { readonly relation_ref: string; readonly owner_capability_ref: string; readonly relation_kind: RelationKind; readonly parent_entity_ref?: string; readonly child_entity_ref?: string; readonly left_entity_ref?: string; readonly right_entity_ref?: string; }
export interface RelationalSemanticModel { readonly capability_ref: string; readonly entities: readonly RelationalEntitySemantic[]; readonly relations: readonly RelationalRelationSemantic[]; }
export interface RelationalMaterializerInput { readonly source_contract_ref: string; readonly source_contract_hash: string; readonly schema_name: string; readonly relational_semantics: RelationalSemanticModel; }
export interface RelationalColumnPlan { readonly column_name: string; readonly data_type: string; readonly nullable: boolean; readonly framework_owned?: boolean; readonly business_field_ref?: string; }
export interface RelationalForeignKeyPlan { readonly column_name: string; readonly target_table: string; readonly target_column: "q_ref"; readonly unique: boolean; }
export interface RelationalTablePlan { readonly table_name: string; readonly owner_capability_ref: string; readonly source_semantic_ref: string; readonly table_kind: "ENTITY" | "RELATION"; readonly columns: readonly RelationalColumnPlan[]; readonly business_identity_columns: readonly string[]; readonly foreign_keys: readonly RelationalForeignKeyPlan[]; readonly unique_constraints: readonly (readonly string[])[]; }
export interface RelationalSchemaPlan { readonly representation_version: "P1_RELATIONAL_SCHEMA_PLAN_V1"; readonly source_contract_ref: string; readonly source_contract_hash: string; readonly capability_ref: string; readonly schema_name: string; readonly tables: readonly RelationalTablePlan[]; readonly ordered_ddl: readonly string[]; readonly content_hash: string; }

export function stableClone(value: unknown): unknown { if (Array.isArray(value)) return value.map(stableClone); if (value !== null && typeof value === "object") { const out: Record<string, unknown> = {}; for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = stableClone((value as Record<string, unknown>)[key]); return out; } return value; }
export function sha256Canonical(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(stableClone(value)), "utf8").digest("hex")}`; }
