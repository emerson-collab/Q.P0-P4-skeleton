import assert from "node:assert/strict";
import test from "node:test";
import {
  PERSISTENCE_COMPILER_PROFILE_HASH,
  PERSISTENCE_COMPILER_PROFILE_REF,
  compileCapabilityPersistenceSchema,
  sha256ExactBytes,
} from "../../../src/p1/business_runtime/persistence_schema_compiler.ts";
import type { CapabilitySchemaDefinitionArtifact } from "../../../src/p1/business_runtime/persistence_schema_compiler.ts";
import {
  PersistenceSchemaApplyError,
  applyCapabilityPersistenceSchema,
} from "../../../src/p1/business_runtime/persistence_schema_apply.ts";
import type {
  CatalogProjectionRow,
  GovernedArtifactStore,
  MigrationReceiptIndex,
  RelationalSchemaExecutor,
  RelationalSchemaTransaction,
  SchemaApplyDependencies,
} from "../../../src/p1/business_runtime/persistence_schema_apply.ts";

const SOURCE_BYTES = Buffer.from("exact-capability-source", "utf8");

function schemaDefinition(): CapabilitySchemaDefinitionArtifact {
  const ref = "Q.TEST.CONTRACT.CAPABILITY.CASE_MANAGEMENT@V0100";
  return compileCapabilityPersistenceSchema({
    source_capability_contract_ref: ref,
    source_capability_contract_hash: sha256ExactBytes(SOURCE_BYTES),
    capability_contract: {
      q_id: "Q.TEST.CONTRACT.CAPABILITY.CASE_MANAGEMENT",
      q_version: "V0100",
      identity: { capability_ref: "Q.TEST.CAPABILITY.CASE_MANAGEMENT@V0100", capability_contract_ref: ref },
      business_object_ownership: { owned_business_objects: ["case_record"] },
      state_model: { allowed_business_states: ["DRAFT", "ACTIVE"] },
      persistence_requirements: { persistence_required: true },
      operations: { create_case: { operation_ref: `${ref}#/operations/create_case` } },
      payload_schema_bindings: { create_case: { request_contract_ref: `${ref}#/contracts/request`, response_contract_ref: `${ref}#/contracts/response` } },
      contracts: { request: { contract_ref: `${ref}#/contracts/request` }, response: { contract_ref: `${ref}#/contracts/response` } },
      p1_local_dependency_declarations: { dependency_count: 0, dependencies: {} },
    },
    instance_persistence_binding: { dialect: "postgresql", schema_name: "case_instance" },
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
  });
}

function rowsFor(definition: CapabilitySchemaDefinitionArtifact): readonly CatalogProjectionRow[] {
  const spec = definition.payload.physical_schema_spec;
  return spec.database_objects.flatMap((object) => object.columns.map((column) => ({
    schema_name: spec.schema_name,
    object_kind: object.object_kind,
    object_name: object.object_name,
    column_name: column.column_name,
    ordinal_position: column.ordinal_position,
    data_type: column.data_type,
    is_nullable: column.is_nullable,
  })));
}

class MemoryArtifactStore implements GovernedArtifactStore {
  readonly data = new Map<string, Uint8Array>();
  readonly events: string[] = [];
  async writeImmutable(input: Readonly<{ artifact_ref: string; content_hash: string; bytes: Uint8Array }>): Promise<void> {
    const existing = this.data.get(input.artifact_ref);
    if (existing !== undefined && Buffer.compare(Buffer.from(existing), Buffer.from(input.bytes)) !== 0) throw new Error("immutable conflict");
    this.data.set(input.artifact_ref, Buffer.from(input.bytes));
    this.events.push(`write:${input.artifact_ref}`);
  }
  async readImmutable(input: Readonly<{ artifact_ref: string; content_hash: string }>): Promise<Uint8Array> {
    const bytes = this.data.get(input.artifact_ref);
    if (bytes === undefined) throw new Error("missing artifact");
    this.events.push(`read:${input.artifact_ref}`);
    return Buffer.from(bytes);
  }
}

class MemoryReceiptIndex implements MigrationReceiptIndex {
  readonly rows: unknown[] = [];
  constructor(private readonly store: MemoryArtifactStore) {}
  async commit(input: Parameters<MigrationReceiptIndex["commit"]>[0]): Promise<void> {
    assert.ok(this.store.data.has(input.receipt_ref), "receipt must be durable before index commit");
    this.rows.push(input);
    this.store.events.push(`index:${input.receipt_ref}`);
  }
}

class MemoryRelationalExecutor implements RelationalSchemaExecutor {
  readonly executed: string[] = [];
  transaction_calls = 0;
  fail_on_execute = false;
  constructor(readonly before: readonly CatalogProjectionRow[], readonly after: readonly CatalogProjectionRow[]) {}
  async catalogProjection(_schema_name: string): Promise<readonly CatalogProjectionRow[]> { return this.before; }
  async transaction<T>(fn: (tx: RelationalSchemaTransaction) => Promise<T>): Promise<T> {
    this.transaction_calls += 1;
    const tx: RelationalSchemaTransaction = {
      execute: async (statement: string) => {
        if (this.fail_on_execute) throw new Error("ddl failed");
        this.executed.push(statement);
      },
      catalogProjection: async () => this.after,
    };
    return fn(tx);
  }
}

function dependencies(definition: CapabilitySchemaDefinitionArtifact, executor: MemoryRelationalExecutor) {
  const store = new MemoryArtifactStore();
  const index = new MemoryReceiptIndex(store);
  const deps: SchemaApplyDependencies = {
    source_reader: { readExact: async () => Buffer.from(SOURCE_BYTES) },
    artifact_store: store,
    relational_executor: executor,
    migration_receipt_index: index,
  };
  return { store, index, deps };
}

test("schema apply verifies artifact/source, executes exact DDL, verifies catalog and indexes durable receipt last", async () => {
  const definition = schemaDefinition();
  const executor = new MemoryRelationalExecutor([], rowsFor(definition));
  const { store, index, deps } = dependencies(definition, executor);
  const result = await applyCapabilityPersistenceSchema(definition, deps);
  assert.deepEqual(executor.executed, definition.payload.physical_schema_spec.ordered_ddl);
  assert.equal(result.migration_receipt.payload.execution_status, "APPLIED");
  assert.equal(result.migration_receipt.payload.executed_statement_count, 1);
  assert.equal(index.rows.length, 1);
  const receiptRef = result.migration_receipt.artifact_ref;
  const writeIndex = store.events.indexOf(`write:${receiptRef}`);
  const readIndex = store.events.indexOf(`read:${receiptRef}`);
  const indexIndex = store.events.indexOf(`index:${receiptRef}`);
  assert.ok(writeIndex >= 0 && readIndex > writeIndex && indexIndex > readIndex);
});

test("source hash mismatch fails before any DDL transaction", async () => {
  const definition = schemaDefinition();
  const executor = new MemoryRelationalExecutor([], rowsFor(definition));
  const store = new MemoryArtifactStore();
  const index = new MemoryReceiptIndex(store);
  await assert.rejects(
    () => applyCapabilityPersistenceSchema(definition, {
      source_reader: { readExact: async () => Buffer.from("wrong-source", "utf8") },
      artifact_store: store,
      relational_executor: executor,
      migration_receipt_index: index,
    }),
    (error: unknown) => error instanceof PersistenceSchemaApplyError && error.code === "P1_SOURCE_HASH_MISMATCH",
  );
  assert.equal(executor.transaction_calls, 0);
  assert.equal(index.rows.length, 0);
});

test("DDL failure rolls back through executor boundary and emits a durable FAILED receipt", async () => {
  const definition = schemaDefinition();
  const executor = new MemoryRelationalExecutor([], rowsFor(definition));
  executor.fail_on_execute = true;
  const { store, index, deps } = dependencies(definition, executor);
  await assert.rejects(
    () => applyCapabilityPersistenceSchema(definition, deps),
    (error: unknown) => error instanceof PersistenceSchemaApplyError
      && error.migration_receipt?.payload.execution_status === "FAILED",
  );
  assert.equal(index.rows.length, 1);
  const indexed = index.rows[0] as { receipt_ref: string; execution_status: string };
  assert.equal(indexed.execution_status, "FAILED");
  assert.ok(store.data.has(indexed.receipt_ref));
});

test("post-apply catalog mismatch fails closed and emits FAILED receipt", async () => {
  const definition = schemaDefinition();
  const badRows = rowsFor(definition).filter((row) => row.column_name !== "q_payload");
  const executor = new MemoryRelationalExecutor([], badRows);
  const { index, deps } = dependencies(definition, executor);
  await assert.rejects(
    () => applyCapabilityPersistenceSchema(definition, deps),
    (error: unknown) => error instanceof PersistenceSchemaApplyError && error.code === "P1_SCHEMA_CATALOG_MISMATCH",
  );
  assert.equal(index.rows.length, 1);
});
