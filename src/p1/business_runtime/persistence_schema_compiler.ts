import { createHash } from "node:crypto";

export type JsonObject = Readonly<Record<string, unknown>>;

export const DATABASE_PERSISTENCE_CONTRACT_REF =
  "Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0111" as const;
export const DATABASE_PERSISTENCE_CONTRACT_HASH =
  "sha256:6c58e320800fae2624b1c2a1a667c5bee9709f5dee5197dd1f114020bd8e5997" as const;
export const PERSISTENCE_COMPILER_PROFILE_REF =
  "Q.SS.STD.META.CONTRACT.DATABASE_PERSISTENCE@V0111#/capability_local_schema_compiler_profiles/P1_CAPABILITY_LOCAL_RELATIONAL_V1" as const;
export const PERSISTENCE_COMPILER_PROFILE_HASH =
  "sha256:cd31e1d1f7955ab0e906c6403a0f9cb53c9f4c39629e85e1b0ffbf7884c4a7df" as const;
export const PHYSICAL_SCHEMA_REPRESENTATION_VERSION = "CAPABILITY_PHYSICAL_SCHEMA_SPEC_V1" as const;
export const SCHEMA_DEFINITION_ARTIFACT_KIND = "CAPABILITY_SCHEMA_DEFINITION" as const;
export const CATALOG_FINGERPRINT_PROFILE_ID = "RELATIONAL_CATALOG_FINGERPRINT_V1" as const;

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const LOWER_SNAKE_SQL_LOCAL_NAME = /^[a-z][a-z0-9_]*$/;

export class PersistenceSchemaCompileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PersistenceSchemaCompileError";
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!isObject(value)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_INPUT_INVALID", `${field} must be an object`);
  return value;
}
function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_INPUT_INVALID", `${field} must be a non-empty string`);
  }
  return value;
}
function sha256Value(value: unknown, field: string): string {
  const text = stringValue(value, field);
  if (!SHA256.test(text)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_HASH_INVALID", `${field} must be exact sha256`);
  return text;
}
function arrayValue(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_INPUT_INVALID", `${field} must be an array`);
  return value;
}
function sqlLocalName(value: unknown, field: string): string {
  const text = stringValue(value, field);
  if (!LOWER_SNAKE_SQL_LOCAL_NAME.test(text)) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_SQL_NAME_INVALID", `${field} must already be a valid lower_snake SQL local name`);
  }
  return text;
}
function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(stableClone));
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = stableClone(value[key]);
    return Object.freeze(out);
  }
  return value;
}
export function canonicalJson(value: unknown): string {
  return JSON.stringify(stableClone(value));
}
export function sha256ExactBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
export function sha256CanonicalJson(value: unknown): string {
  return sha256ExactBytes(Buffer.from(canonicalJson(value), "utf8"));
}

export interface CapabilityPersistenceCompileInput {
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly capability_contract: JsonObject;
  readonly instance_persistence_binding: Readonly<{
    dialect: string;
    schema_name: string;
  }>;
  readonly compiler_profile_ref: string;
  readonly compiler_profile_hash: string;
}

export interface PhysicalColumnSpec {
  readonly column_name: string;
  readonly ordinal_position: number;
  readonly data_type: string;
  readonly is_nullable: boolean;
  readonly primary_key?: boolean;
  readonly default_value?: unknown;
  readonly allowed_values?: readonly string[];
}
export interface PhysicalDatabaseObjectSpec {
  readonly object_ref: string;
  readonly object_kind: "TABLE";
  readonly object_name: string;
  readonly source_business_object_ref: string;
  readonly columns: readonly PhysicalColumnSpec[];
}
export interface CapabilityPhysicalSchemaSpec {
  readonly representation_version: typeof PHYSICAL_SCHEMA_REPRESENTATION_VERSION;
  readonly dialect: "postgresql";
  readonly schema_name: string;
  readonly owner_capability_ref: string;
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly compiler_profile_ref: typeof PERSISTENCE_COMPILER_PROFILE_REF;
  readonly compiler_profile_hash: typeof PERSISTENCE_COMPILER_PROFILE_HASH;
  readonly database_objects: readonly PhysicalDatabaseObjectSpec[];
  readonly ordered_ddl: readonly string[];
  readonly object_statement_bindings: readonly Readonly<{
    source_business_object_ref: string;
    database_object_ref: string;
    ordered_ddl_index: number;
  }>[];
  readonly catalog_fingerprint_profile: Readonly<{
    profile_id: typeof CATALOG_FINGERPRINT_PROFILE_ID;
    projection_tuple_fields: readonly [
      "schema_name",
      "object_kind",
      "object_name",
      "column_name",
      "ordinal_position",
      "data_type",
      "is_nullable",
    ];
    rows_sorted_lexicographically_by_tuple_before_hash: true;
  }>;
}
export interface CapabilitySchemaDefinitionArtifactPayload {
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly owner_capability_ref: string;
  readonly instance_persistence_binding: Readonly<{ dialect: "postgresql"; schema_name: string }>;
  readonly compiler_profile_ref: typeof PERSISTENCE_COMPILER_PROFILE_REF;
  readonly compiler_profile_hash: typeof PERSISTENCE_COMPILER_PROFILE_HASH;
  readonly physical_schema_spec: CapabilityPhysicalSchemaSpec;
  readonly physical_schema_spec_hash: string;
  readonly database_object_refs: readonly string[];
}
export interface CapabilitySchemaDefinitionArtifact {
  readonly artifact_kind: typeof SCHEMA_DEFINITION_ARTIFACT_KIND;
  readonly artifact_ref: string;
  readonly content_hash: string;
  readonly payload: CapabilitySchemaDefinitionArtifactPayload;
}

function exactContractRefFromHeader(contract: Record<string, unknown>): string {
  const qId = stringValue(contract.q_id, "capability_contract.q_id");
  const qVersion = stringValue(contract.q_version, "capability_contract.q_version");
  return `${qId}@${qVersion}`;
}

function validateOperationClosure(contract: Record<string, unknown>): void {
  const operations = objectValue(contract.operations, "capability_contract.operations");
  if (Object.keys(operations).length === 0) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_OPERATION_CLOSURE_INVALID", "at least one Operation is required");
  }
  const bindings = objectValue(contract.payload_schema_bindings, "capability_contract.payload_schema_bindings");
  const contracts = objectValue(contract.contracts, "capability_contract.contracts");
  const contractRefs = new Set<string>();
  for (const [key, value] of Object.entries(contracts)) {
    const item = objectValue(value, `capability_contract.contracts.${key}`);
    contractRefs.add(stringValue(item.contract_ref, `capability_contract.contracts.${key}.contract_ref`));
  }
  for (const operationId of Object.keys(operations)) {
    const operation = objectValue(operations[operationId], `capability_contract.operations.${operationId}`);
    stringValue(operation.operation_ref, `operations.${operationId}.operation_ref`);
    const binding = objectValue(bindings[operationId], `payload_schema_bindings.${operationId}`);
    const requestRef = stringValue(binding.request_contract_ref, `payload_schema_bindings.${operationId}.request_contract_ref`);
    const responseRef = stringValue(binding.response_contract_ref, `payload_schema_bindings.${operationId}.response_contract_ref`);
    if (!contractRefs.has(requestRef) || !contractRefs.has(responseRef)) {
      throw new PersistenceSchemaCompileError("P1_PERSISTENCE_OPERATION_PAYLOAD_CLOSURE_INVALID", `Operation ${operationId} request/response Contract ref is not in the Capability Contract closure`);
    }
  }
}

function readBusinessStates(contract: Record<string, unknown>): readonly string[] {
  if (contract.state_model === undefined) return Object.freeze([]);
  const stateModel = objectValue(contract.state_model, "capability_contract.state_model");
  const candidate = stateModel.allowed_business_states ?? stateModel.allowed_states ?? stateModel.states;
  if (candidate === undefined) return Object.freeze([]);
  const values = arrayValue(candidate, "capability_contract.state_model.allowed_states").map((value, index) => stringValue(value, `states[${index}]`));
  if (new Set(values).size !== values.length) throw new PersistenceSchemaCompileError("P1_PERSISTENCE_STATE_MODEL_INVALID", "state values must be unique");
  return Object.freeze(values);
}

function physicalColumns(states: readonly string[]): readonly PhysicalColumnSpec[] {
  return Object.freeze([
    Object.freeze({ column_name: "q_ref", ordinal_position: 1, data_type: "text", is_nullable: false, primary_key: true }),
    Object.freeze({ column_name: "q_state", ordinal_position: 2, data_type: "text", is_nullable: true, ...(states.length ? { allowed_values: Object.freeze([...states]) } : {}) }),
    Object.freeze({ column_name: "q_revision", ordinal_position: 3, data_type: "bigint", is_nullable: false, default_value: 1 }),
    Object.freeze({ column_name: "q_payload", ordinal_position: 4, data_type: "jsonb", is_nullable: false }),
    Object.freeze({ column_name: "q_created_at", ordinal_position: 5, data_type: "timestamptz", is_nullable: false }),
    Object.freeze({ column_name: "q_updated_at", ordinal_position: 6, data_type: "timestamptz", is_nullable: false }),
  ]);
}

function createTableDdl(schemaName: string, objectName: string): string {
  const qualified = `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`;
  return `CREATE TABLE IF NOT EXISTS ${qualified} (`
    + `"q_ref" text PRIMARY KEY, `
    + `"q_state" text, `
    + `"q_revision" bigint NOT NULL DEFAULT 1, `
    + `"q_payload" jsonb NOT NULL, `
    + `"q_created_at" timestamptz NOT NULL, `
    + `"q_updated_at" timestamptz NOT NULL);`;
}

/**
 * Compile one exact Capability semantic source into a Capability-local physical schema artifact.
 * This function performs no AI/model call, reads no handler/test/live database state, and never
 * merges business semantics across Capabilities.
 */
export function compileCapabilityPersistenceSchema(
  input: CapabilityPersistenceCompileInput,
): CapabilitySchemaDefinitionArtifact {
  const sourceRef = stringValue(input.source_capability_contract_ref, "source_capability_contract_ref");
  const sourceHash = sha256Value(input.source_capability_contract_hash, "source_capability_contract_hash");
  if (input.compiler_profile_ref !== PERSISTENCE_COMPILER_PROFILE_REF || input.compiler_profile_hash !== PERSISTENCE_COMPILER_PROFILE_HASH) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_COMPILER_PROFILE_MISMATCH", "exact V0111 compiler profile ref/hash required");
  }
  const binding = objectValue(input.instance_persistence_binding, "instance_persistence_binding");
  if (binding.dialect !== "postgresql") throw new PersistenceSchemaCompileError("P1_PERSISTENCE_DIALECT_UNSUPPORTED", "only postgresql is supported by P1_CAPABILITY_LOCAL_RELATIONAL_V1");
  const schemaName = sqlLocalName(binding.schema_name, "instance_persistence_binding.schema_name");
  const contract = objectValue(input.capability_contract, "capability_contract");
  if (exactContractRefFromHeader(contract) !== sourceRef) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_SOURCE_IDENTITY_MISMATCH", "source ref does not match Capability Contract q_id/q_version");
  }
  const identity = objectValue(contract.identity, "capability_contract.identity");
  const ownerCapabilityRef = stringValue(identity.capability_ref, "capability_contract.identity.capability_ref");
  if (stringValue(identity.capability_contract_ref, "capability_contract.identity.capability_contract_ref") !== sourceRef) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_SOURCE_IDENTITY_MISMATCH", "identity.capability_contract_ref mismatch");
  }
  const persistence = objectValue(contract.persistence_requirements, "capability_contract.persistence_requirements");
  if (persistence.persistence_required !== true) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_NOT_REQUIRED", "Capability does not declare persistence_required=true");
  }
  validateOperationClosure(contract);
  if (contract.p1_local_dependency_declarations !== undefined) objectValue(contract.p1_local_dependency_declarations, "capability_contract.p1_local_dependency_declarations");

  const ownership = objectValue(contract.business_object_ownership, "capability_contract.business_object_ownership");
  const ownedObjects = arrayValue(ownership.owned_business_objects, "capability_contract.business_object_ownership.owned_business_objects")
    .map((value, index) => sqlLocalName(value, `owned_business_objects[${index}]`));
  if (ownedObjects.length === 0 || new Set(ownedObjects).size !== ownedObjects.length) {
    throw new PersistenceSchemaCompileError("P1_PERSISTENCE_OBJECT_OWNERSHIP_INVALID", "owned_business_objects must be non-empty and unique");
  }
  const states = readBusinessStates(contract);
  const columns = physicalColumns(states);
  const databaseObjects: PhysicalDatabaseObjectSpec[] = [];
  const orderedDdl: string[] = [];
  const bindings: { source_business_object_ref: string; database_object_ref: string; ordered_ddl_index: number }[] = [];
  for (const sourceBusinessObjectRef of ownedObjects) {
    const objectRef = `${schemaName}.${sourceBusinessObjectRef}`;
    const index = orderedDdl.length;
    databaseObjects.push(Object.freeze({
      object_ref: objectRef,
      object_kind: "TABLE" as const,
      object_name: sourceBusinessObjectRef,
      source_business_object_ref: sourceBusinessObjectRef,
      columns,
    }));
    orderedDdl.push(createTableDdl(schemaName, sourceBusinessObjectRef));
    bindings.push(Object.freeze({ source_business_object_ref: sourceBusinessObjectRef, database_object_ref: objectRef, ordered_ddl_index: index }));
  }

  const physicalSchemaSpec: CapabilityPhysicalSchemaSpec = Object.freeze({
    representation_version: PHYSICAL_SCHEMA_REPRESENTATION_VERSION,
    dialect: "postgresql" as const,
    schema_name: schemaName,
    owner_capability_ref: ownerCapabilityRef,
    source_capability_contract_ref: sourceRef,
    source_capability_contract_hash: sourceHash,
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
    database_objects: Object.freeze(databaseObjects),
    ordered_ddl: Object.freeze(orderedDdl),
    object_statement_bindings: Object.freeze(bindings),
    catalog_fingerprint_profile: Object.freeze({
      profile_id: CATALOG_FINGERPRINT_PROFILE_ID,
      projection_tuple_fields: Object.freeze([
        "schema_name", "object_kind", "object_name", "column_name", "ordinal_position", "data_type", "is_nullable",
      ]) as CapabilityPhysicalSchemaSpec["catalog_fingerprint_profile"]["projection_tuple_fields"],
      rows_sorted_lexicographically_by_tuple_before_hash: true as const,
    }),
  });
  const physicalHash = sha256CanonicalJson(physicalSchemaSpec);
  const payload: CapabilitySchemaDefinitionArtifactPayload = Object.freeze({
    source_capability_contract_ref: sourceRef,
    source_capability_contract_hash: sourceHash,
    owner_capability_ref: ownerCapabilityRef,
    instance_persistence_binding: Object.freeze({ dialect: "postgresql" as const, schema_name: schemaName }),
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
    physical_schema_spec: physicalSchemaSpec,
    physical_schema_spec_hash: physicalHash,
    database_object_refs: Object.freeze(databaseObjects.map((object) => object.object_ref)),
  });
  const contentHash = sha256CanonicalJson(payload);
  return Object.freeze({
    artifact_kind: SCHEMA_DEFINITION_ARTIFACT_KIND,
    artifact_ref: `urn:q:capability-schema-definition:${contentHash.slice("sha256:".length)}`,
    content_hash: contentHash,
    payload,
  });
}
