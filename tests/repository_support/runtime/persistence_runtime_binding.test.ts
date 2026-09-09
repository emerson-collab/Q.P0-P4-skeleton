import assert from "node:assert/strict";
import test from "node:test";
import {
  PERSISTENCE_COMPILER_PROFILE_HASH,
  PERSISTENCE_COMPILER_PROFILE_REF,
  canonicalJson,
  compileCapabilityPersistenceSchema,
  sha256ExactBytes,
} from "../../../src/p1/business_runtime/persistence_schema_compiler.ts";
import type {
  GovernedArtifactStore,
  MigrationReceiptIndex,
} from "../../../src/p1/business_runtime/persistence_schema_apply.ts";
import {
  activateP1CapabilityWithRuntimeBinding,
  type P1PersistenceRuntimeBinding,
} from "../../../runtime/persistence/persistence_runtime_binding.ts";
import type { PostgresqlSessionProvider } from "../../../runtime/persistence/postgresql_relational_executor.ts";

const sourceRef = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const ownerRef = "Q.TEST.CAPABILITY.EXAMPLE@V0100";
const instanceBinding = Object.freeze({
  database_instance_ref: "db.instance.test.primary",
  dialect: "postgresql" as const,
  schema_name: "q_test",
});
const capabilityContract = Object.freeze({
  q_id: "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE",
  q_version: "V0100",
  identity: Object.freeze({
    capability_ref: ownerRef,
    capability_contract_ref: sourceRef,
  }),
  persistence_requirements: Object.freeze({ persistence_required: true }),
  relational_semantics: Object.freeze({
    capability_ref: ownerRef,
    entities: Object.freeze([
      Object.freeze({
        entity_ref: "example_record",
        owner_capability_ref: ownerRef,
        fields: Object.freeze([
          Object.freeze({
            field_ref: "example_record.record_id",
            field_name: "record_id",
            semantic_type: "TEXT" as const,
            required: true,
            identity: true,
          }),
        ]),
      }),
    ]),
    relations: Object.freeze([]),
  }),
});

function createProvider(expectedRows: readonly Readonly<Record<string, unknown>>[], statements: string[]): PostgresqlSessionProvider {
  let applied = false;
  return Object.freeze({
    database_instance_ref: instanceBinding.database_instance_ref,
    async withSession<T>(fn: (session: { query(sql: string, parameters?: readonly unknown[]): Promise<{ rows: readonly Readonly<Record<string, unknown>>[] }> }) => Promise<T>): Promise<T> {
      return fn({
        async query(sql: string): Promise<{ rows: readonly Readonly<Record<string, unknown>>[] }> {
          statements.push(sql);
          if (sql.includes("information_schema.columns")) return { rows: applied ? expectedRows : [] };
          if (sql.startsWith("CREATE TABLE")) applied = true;
          return { rows: [] };
        },
      });
    },
  });
}

function artifactStore(artifacts: Map<string, Uint8Array>): GovernedArtifactStore {
  return Object.freeze({
    async writeImmutable(input): Promise<void> {
      const existing = artifacts.get(input.artifact_ref);
      if (existing !== undefined) assert.deepEqual(existing, input.bytes);
      artifacts.set(input.artifact_ref, new Uint8Array(input.bytes));
    },
    async readImmutable(input): Promise<Uint8Array> {
      const bytesValue = artifacts.get(input.artifact_ref);
      assert.ok(bytesValue);
      return new Uint8Array(bytesValue);
    },
  });
}

function receiptIndex(receiptBindings: string[]): MigrationReceiptIndex {
  return Object.freeze({
    async commit(input): Promise<void> {
      receiptBindings.push(`${input.receipt_ref}|${input.receipt_hash}`);
    },
  });
}

test("P1 runtime binding activates persistent Capability through deterministic schema apply", async () => {
  const bytes = Buffer.from(canonicalJson(capabilityContract), "utf8");
  const sourceHash = sha256ExactBytes(bytes);
  const artifact = compileCapabilityPersistenceSchema({
    source_capability_contract_ref: sourceRef,
    source_capability_contract_hash: sourceHash,
    capability_contract: capabilityContract,
    instance_persistence_binding: instanceBinding,
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
  });
  const expectedRows = artifact.payload.physical_schema_spec.database_objects.flatMap((object) => object.columns.map((column) => ({
    schema_name: instanceBinding.schema_name,
    object_name: object.object_name,
    column_name: column.column_name,
    ordinal_position: column.ordinal_position,
    data_type: column.data_type === "timestamptz" ? "timestamp with time zone" : column.data_type,
    is_nullable: column.is_nullable ? "YES" : "NO",
  })));

  const artifacts = new Map<string, Uint8Array>();
  const receiptBindings: string[] = [];
  const statements: string[] = [];
  const runtimeBinding: P1PersistenceRuntimeBinding = Object.freeze({
    instance_persistence_binding: instanceBinding,
    postgresql_session_provider: createProvider(expectedRows, statements),
    artifact_store: artifactStore(artifacts),
    migration_receipt_index: receiptIndex(receiptBindings),
  });

  const result = await activateP1CapabilityWithRuntimeBinding(
    Object.freeze({
      implementation_ref: "implementation:test@example",
      provided_interface_refs: Object.freeze([`${sourceRef}#/interfaces/example_invoke`]),
    }),
    Object.freeze({
      source_capability_contract_ref: sourceRef,
      source_capability_contract_hash: sourceHash,
      source_capability_contract_bytes: bytes,
      capability_contract: capabilityContract,
    }),
    runtimeBinding,
  );

  assert.equal(result.stage_extension.status, "active");
  assert.equal(result.persistence_activation.status, "SATISFIED");
  assert.equal(result.persistence_activation.database_instance_ref, instanceBinding.database_instance_ref);
  assert.equal(result.persistence_activation.schema_apply_result?.migration_receipt.payload.execution_status, "APPLIED");
  assert.equal(receiptBindings.length, 1);
  assert.ok(statements.some((statement) => statement.startsWith("CREATE TABLE")));
  assert.ok(statements.includes("BEGIN"));
  assert.ok(statements.includes("COMMIT"));
});

test("P1 runtime binding fails closed when caller supplies a different instance binding", async () => {
  const bytes = Buffer.from(canonicalJson(capabilityContract), "utf8");
  const sourceHash = sha256ExactBytes(bytes);
  const statements: string[] = [];
  const runtimeBinding: P1PersistenceRuntimeBinding = Object.freeze({
    instance_persistence_binding: instanceBinding,
    postgresql_session_provider: createProvider([], statements),
    artifact_store: artifactStore(new Map<string, Uint8Array>()),
    migration_receipt_index: receiptIndex([]),
  });

  await assert.rejects(
    () => activateP1CapabilityWithRuntimeBinding(
      Object.freeze({ implementation_ref: "implementation:test@example", provided_interface_refs: Object.freeze([]) }),
      Object.freeze({
        source_capability_contract_ref: sourceRef,
        source_capability_contract_hash: sourceHash,
        source_capability_contract_bytes: bytes,
        capability_contract: capabilityContract,
        instance_persistence_binding: Object.freeze({
          database_instance_ref: "db.instance.other",
          dialect: "postgresql" as const,
          schema_name: "q_other",
        }),
      }),
      runtimeBinding,
    ),
    /does not match the injected runtime binding/,
  );
  assert.equal(statements.length, 0);
});
