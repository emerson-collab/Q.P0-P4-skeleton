import {
  DATABASE_PERSISTENCE_CONTRACT_REF,
  PERSISTENCE_COMPILER_PROFILE_HASH,
  PERSISTENCE_COMPILER_PROFILE_REF,
  canonicalJson,
  sha256CanonicalJson,
  sha256ExactBytes,
} from "./persistence_schema_compiler.ts";
import type {
  CapabilityPhysicalSchemaSpec,
  CapabilitySchemaDefinitionArtifact,
  JsonObject,
  PhysicalDatabaseObjectSpec,
} from "./persistence_schema_compiler.ts";

export const MIGRATION_RECEIPT_ARTIFACT_KIND = "CAPABILITY_SCHEMA_MIGRATION_RECEIPT" as const;
export const CATALOG_FINGERPRINT_PROFILE_ID = "RELATIONAL_CATALOG_FINGERPRINT_V1" as const;

export interface CatalogProjectionRow {
  readonly schema_name: string;
  readonly object_kind: string;
  readonly object_name: string;
  readonly column_name: string;
  readonly ordinal_position: number;
  readonly data_type: string;
  readonly is_nullable: boolean;
}

export interface ExactSourceReader {
  readExact(input: Readonly<{ source_ref: string; source_hash: string }>): Promise<Uint8Array>;
}

export interface GovernedArtifactStore {
  writeImmutable(input: Readonly<{ artifact_ref: string; content_hash: string; bytes: Uint8Array }>): Promise<void>;
  readImmutable(input: Readonly<{ artifact_ref: string; content_hash: string }>): Promise<Uint8Array>;
}

export interface RelationalSchemaTransaction {
  execute(statement: string): Promise<void>;
  catalogProjection(schema_name: string): Promise<readonly CatalogProjectionRow[]>;
}

export interface RelationalSchemaExecutor {
  catalogProjection(schema_name: string): Promise<readonly CatalogProjectionRow[]>;
  transaction<T>(fn: (tx: RelationalSchemaTransaction) => Promise<T>): Promise<T>;
}

export interface MigrationReceiptIndex {
  commit(input: Readonly<{
    receipt_ref: string;
    receipt_hash: string;
    source_capability_contract_ref: string;
    source_capability_contract_hash: string;
    owner_capability_ref: string;
    compiler_profile_ref: string;
    compiler_profile_hash: string;
    schema_definition_ref: string;
    schema_definition_hash: string;
    execution_status: "APPLIED" | "FAILED";
  }>): Promise<void>;
}

export interface SchemaApplyDependencies {
  readonly source_reader: ExactSourceReader;
  readonly artifact_store: GovernedArtifactStore;
  readonly relational_executor: RelationalSchemaExecutor;
  readonly migration_receipt_index: MigrationReceiptIndex;
}

export interface MigrationReceiptPayload {
  readonly database_persistence_contract_ref: typeof DATABASE_PERSISTENCE_CONTRACT_REF;
  readonly source_capability_contract_ref: string;
  readonly source_capability_contract_hash: string;
  readonly owner_capability_ref: string;
  readonly compiler_profile_ref: typeof PERSISTENCE_COMPILER_PROFILE_REF;
  readonly compiler_profile_hash: typeof PERSISTENCE_COMPILER_PROFILE_HASH;
  readonly schema_definition_ref: string;
  readonly schema_definition_hash: string;
  readonly pre_schema_fingerprint: string;
  readonly post_schema_fingerprint: string;
  readonly execution_status: "APPLIED" | "FAILED";
  readonly executed_statement_count: number;
  readonly failure_material: Readonly<{ code: string; message: string }> | null;
}
export interface MigrationReceiptArtifact {
  readonly artifact_kind: typeof MIGRATION_RECEIPT_ARTIFACT_KIND;
  readonly artifact_ref: string;
  readonly content_hash: string;
  readonly payload: MigrationReceiptPayload;
}
export interface SchemaApplyResult {
  readonly schema_definition_ref: string;
  readonly schema_definition_hash: string;
  readonly migration_receipt: MigrationReceiptArtifact;
}

export class PersistenceSchemaApplyError extends Error {
  readonly code: string;
  readonly migration_receipt: MigrationReceiptArtifact | undefined;
  constructor(code: string, message: string, migration_receipt?: MigrationReceiptArtifact) {
    super(message);
    this.name = "PersistenceSchemaApplyError";
    this.code = code;
    this.migration_receipt = migration_receipt;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function normalizeError(error: unknown): Readonly<{ code: string; message: string }> {
  if (error instanceof PersistenceSchemaApplyError) return Object.freeze({ code: error.code, message: error.message });
  if (error instanceof Error) return Object.freeze({ code: "P1_SCHEMA_APPLY_FAILED", message: error.message });
  return Object.freeze({ code: "P1_SCHEMA_APPLY_FAILED", message: String(error) });
}
function exactBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0;
}

function validateSchemaDefinition(artifact: CapabilitySchemaDefinitionArtifact): CapabilityPhysicalSchemaSpec {
  if (artifact.payload.compiler_profile_ref !== PERSISTENCE_COMPILER_PROFILE_REF
      || artifact.payload.compiler_profile_hash !== PERSISTENCE_COMPILER_PROFILE_HASH) {
    throw new PersistenceSchemaApplyError("P1_SCHEMA_COMPILER_PROFILE_MISMATCH", "schema definition compiler profile ref/hash mismatch");
  }
  const physicalHash = sha256CanonicalJson(artifact.payload.physical_schema_spec);
  if (physicalHash !== artifact.payload.physical_schema_spec_hash) {
    throw new PersistenceSchemaApplyError("P1_SCHEMA_DEFINITION_HASH_MISMATCH", "physical_schema_spec_hash mismatch");
  }
  const contentHash = sha256CanonicalJson(artifact.payload);
  const expectedRef = `urn:q:capability-schema-definition:${contentHash.slice("sha256:".length)}`;
  if (contentHash !== artifact.content_hash || artifact.artifact_ref !== expectedRef) {
    throw new PersistenceSchemaApplyError("P1_SCHEMA_DEFINITION_HASH_MISMATCH", "schema definition artifact ref/hash mismatch");
  }
  if (artifact.payload.physical_schema_spec.source_capability_contract_ref !== artifact.payload.source_capability_contract_ref
      || artifact.payload.physical_schema_spec.source_capability_contract_hash !== artifact.payload.source_capability_contract_hash
      || artifact.payload.physical_schema_spec.owner_capability_ref !== artifact.payload.owner_capability_ref) {
    throw new PersistenceSchemaApplyError("P1_SCHEMA_DEFINITION_BINDING_MISMATCH", "schema definition source/owner binding mismatch");
  }
  return artifact.payload.physical_schema_spec;
}

function rowTuple(row: CatalogProjectionRow): readonly unknown[] {
  return [row.schema_name,row.object_kind,row.object_name,row.column_name,row.ordinal_position,row.data_type,row.is_nullable];
}
function compareTuple(left: readonly unknown[], right: readonly unknown[]): number {
  const a = left.map((v) => typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  const b = right.map((v) => typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  for (let index = 0; index < a.length; index += 1) {
    const leftValue = a[index]!;
    const rightValue = b[index]!;
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}
export function catalogFingerprint(rows: readonly CatalogProjectionRow[]): string {
  const canonicalRows = [...rows]
    .map((row) => Object.freeze({
      schema_name: row.schema_name,
      object_kind: row.object_kind,
      object_name: row.object_name,
      column_name: row.column_name,
      ordinal_position: row.ordinal_position,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    }))
    .sort((left, right) => compareTuple(rowTuple(left), rowTuple(right)));
  return sha256CanonicalJson(canonicalRows);
}

function expectedRows(spec: CapabilityPhysicalSchemaSpec): readonly CatalogProjectionRow[] {
  return spec.database_objects.flatMap((object) => object.columns.map((column) => Object.freeze({
    schema_name: spec.schema_name,
    object_kind: object.object_kind,
    object_name: object.object_name,
    column_name: column.column_name,
    ordinal_position: column.ordinal_position,
    data_type: column.data_type,
    is_nullable: column.is_nullable,
  })));
}

function objectKey(row: CatalogProjectionRow): string {
  return `${row.object_kind}:${row.schema_name}.${row.object_name}`;
}

function verifyArtifactObjectClosure(
  spec: CapabilityPhysicalSchemaSpec,
  before: readonly CatalogProjectionRow[],
  after: readonly CatalogProjectionRow[],
): void {
  const declaredObjects = new Set(spec.database_objects.map((object) => `${object.object_kind}:${spec.schema_name}.${object.object_name}`));
  const beforeObjects = new Set(before.map(objectKey));
  const afterObjects = new Set(after.map(objectKey));
  for (const object of declaredObjects) {
    if (!afterObjects.has(object)) throw new PersistenceSchemaApplyError("P1_SCHEMA_OBJECT_MISSING", `declared database object missing after apply: ${object}`);
  }
  for (const object of afterObjects) {
    if (!beforeObjects.has(object) && !declaredObjects.has(object)) {
      throw new PersistenceSchemaApplyError("P1_SCHEMA_UNDECLARED_OBJECT_CREATED", `undeclared database object created: ${object}`);
    }
  }
  const expected = expectedRows(spec);
  for (const object of spec.database_objects) {
    const actualRows = after.filter((row) => row.schema_name === spec.schema_name && row.object_kind === object.object_kind && row.object_name === object.object_name);
    const expectedObjectRows = expected.filter((row) => row.object_name === object.object_name && row.object_kind === object.object_kind);
    if (canonicalJson([...actualRows].sort((a,b)=>a.ordinal_position-b.ordinal_position)
        !== canonicalJson([...expectedObjectRows].sort((a,b)=>a.ordinal_position-b.ordinal_position))) {
      throw new PersistenceSchemaApplyError("P1_SCHEMA_CATALOG_MISMATCH", `catalog projection mismatch for ${object.object_ref}`);
    }
  }
}

async function durableWriteAndReadback(
  store: GovernedArtifactStore,
  artifact_ref: string,
  content_hash: string,
  payload: unknown,
): Promise<void> {
  const bytes = Buffer.from(canonicalJson(payload), "utf8");
  if (sha256ExactBytes(bytes) !== content_hash) {
    throw new PersistenceSchemaApplyError("P1_ARTIFACT_HASH_MISMATCH", "artifact bytes do not match content hash");
  }
  await store.writeImmutable(Object.freeze({ artifact_ref, content_hash, bytes }));
  const readBack = await store.readImmutable(Object.freeze({ artifact_ref, content_hash }));
  if (!exactBytesEqual(readBack, bytes) || sha256ExactBytes(readBack) !== content_hash) {
    throw new PersistenceSchemaApplyError("P1_ARTIFACT_READBACK_MISMATCH", "artifact durable readback mismatch");
  }
}

function createReceipt(
  schemaDefinition: CapabilitySchemaDefinitionArtifact,
  preFingerprint: string,
  postFingerprint: string,
  status: "APPLIED" | "FAILED",
  executedStatementCount: number,
  failureMaterial: Readonly<{ code: string; message: string }> | null,
): MigrationReceiptArtifact {
  const payload: MigrationReceiptPayload = Object.freeze({
    database_persistence_contract_ref: DATABASE_PERSISTENCE_CONTRACT_REF,
    source_capability_contract_ref: schemaDefinition.payload.source_capability_contract_ref,
    source_capability_contract_hash: schemaDefinition.payload.source_capability_contract_hash,
    owner_capability_ref: schemaDefinition.payload.owner_capability_ref,
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
    schema_definition_ref: schemaDefinition.artifact_ref,
    schema_definition_hash: schemaDefinition.content_hash,
    pre_schema_fingerprint: preFingerprint,
    post_schema_fingerprint: postFingerprint,
    execution_status: status,
    executed_statement_count: executedStatementCount,
    failure_material: failureMaterial,
  });
  const contentHash = sha256CanonicalJson(payload);
  return Object.freeze({
    artifact_kind: MIGRATION_RECEIPT_ARTIFACT_KIND,
    artifact_ref: `urn:q:migration-receipt:${contentHash.slice("sha256:".length)}`,
    content_hash: contentHash,
    payload,
  });
}

async function persistReceipt(
  receipt: MigrationReceiptArtifact,
  schemaDefinition: CapabilitySchemaDefinitionArtifact,
  dependencies: SchemaApplyDependencies,
): Promise<void> {
  await durableWriteAndReadback(dependencies.artifact_store, receipt.artifact_ref, receipt.content_hash, receipt.payload);
  await dependencies.migration_receipt_index.commit(Object.freeze({
    receipt_ref: receipt.artifact_ref,
    receipt_hash: receipt.content_hash,
    source_capability_contract_ref: receipt.payload.source_capability_contract_ref,
    source_capability_contract_hash: receipt.payload.source_capability_contract_hash,
    owner_capability_ref: receipt.payload.owner_capability_ref,
    compiler_profile_ref: receipt.payload.compiler_profile_ref,
    compiler_profile_hash: receipt.payload.compiler_profile_hash,
    schema_definition_ref: schemaDefinition.artifact_ref,
    schema_definition_hash: schemaDefinition.content_hash,
    execution_status: receipt.payload.execution_status,
  }));
}

/**
 * Apply an exact compiled Capability schema. The executor only performs DDL from the verified
 * schema-definition artifact. Business Operations never enter this path during invocation.
 */
export async function applyCapabilityPersistenceSchema(
  schemaDefinition: CapabilitySchemaDefinitionArtifact,
  dependencies: SchemaApplyDependencies,
): Promise<SchemaApplyResult> {
  const spec = validateSchemaDefinition(schemaDefinition);
  const sourceBytes = await dependencies.source_reader.readExact(Object.freeze({
    source_ref: schemaDefinition.payload.source_capability_contract_ref,
    source_hash: schemaDefinition.payload.source_capability_contract_hash,
  }));
  if (sha256ExactBytes(sourceBytes) !== schemaDefinition.payload.source_capability_contract_hash) {
    throw new PersistenceSchemaApplyError("P1_SOURCE_HASH_MISMATCH", "exact Capability Source bytes do not match bound hash");
  }
  await durableWriteAndReadback(
    dependencies.artifact_store,
    schemaDefinition.artifact_ref,
    schemaDefinition.content_hash,
    schemaDefinition.payload,
  );

  const preRows = await dependencies.relational_executor.catalogProjection(spec.schema_name);
  const preFingerprint = catalogFingerprint(preRows);
  let executedStatementCount = 0;
  try {
    const transactionResult = await dependencies.relational_executor.transaction(async (tx) => {
      for (const statement of spec.ordered_ddl) {
        await tx.execute(statement);
        executedStatementCount += 1;
      }
      const postRows = await tx.catalogProjection(spec.schema_name);
      verifyArtifactObjectClosure(spec, preRows, postRows);
      return Object.freeze({ postRows, postFingerprint: catalogFingerprint(postRows) });
    });
    const receipt = createReceipt(schemaDefinition, preFingerprint, transactionResult.postFingerprint, "APPLIED", executedStatementCount, null);
    await persistReceipt(receipt, schemaDefinition, dependencies);
    return Object.freeze({
      schema_definition_ref: schemaDefinition.artifact_ref,
      schema_definition_hash: schemaDefinition.content_hash,
      migration_receipt: receipt,
    });
  } catch (error) {
    const failure = normalizeError(error);
    let postFingerprint = preFingerprint;
    try {
      postFingerprint = catalogFingerprint(await dependencies.relational_executor.catalogProjection(spec.schema_name));
    } catch {
      // The failure receipt remains bound to the last verified catalog observation.
    }
    const receipt = createReceipt(schemaDefinition, preFingerprint, postFingerprint, "FAILED", executedStatementCount, failure);
    await persistReceipt(receipt, schemaDefinition, dependencies);
    throw new PersistenceSchemaApplyError(failure.code, failure.message, receipt);
  }
}
