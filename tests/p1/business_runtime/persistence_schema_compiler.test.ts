import assert from "node:assert/strict";
import test from "node:test";
import {
  PERSISTENCE_COMPILER_PROFILE_HASH,
  PERSISTENCE_COMPILER_PROFILE_REF,
  PersistenceSchemaCompileError,
  compileCapabilityPersistenceSchema,
  sha256ExactBytes,
} from "../../../src/p1/business_runtime/persistence_schema_compiler.ts";

function capabilityContract(objects: readonly string[] = ["case_record", "case_evidence"]) {
  const ref = "Q.TEST.CONTRACT.CAPABILITY.CASE_MANAGEMENT@V0100";
  return {
    ref,
    value: {
      q_id: "Q.TEST.CONTRACT.CAPABILITY.CASE_MANAGEMENT",
      q_version: "V0100",
      identity: {
        capability_ref: "Q.TEST.CAPABILITY.CASE_MANAGEMENT@V0100",
        capability_contract_ref: ref,
      },
      business_object_ownership: { owned_business_objects: [...objects] },
      state_model: { allowed_business_states: ["DRAFT", "ACTIVE"] },
      persistence_requirements: { persistence_required: true },
      p1_local_dependency_declarations: { dependency_count: 0, dependencies: {} },
      operations: {
        create_case: { operation_ref: `${ref}#/operations/create_case` },
      },
      payload_schema_bindings: {
        create_case: {
          request_contract_ref: `${ref}#/contracts/create_case_request_contract`,
          response_contract_ref: `${ref}#/contracts/create_case_response_contract`,
        },
      },
      contracts: {
        create_case_request_contract: {
          contract_ref: `${ref}#/contracts/create_case_request_contract`,
          input_schema: { type: "object", required: ["title"], additional_properties: false },
        },
        create_case_response_contract: {
          contract_ref: `${ref}#/contracts/create_case_response_contract`,
          runtime_result_schema: { type: "object", required: ["case_ref"], additional_properties: false },
        },
      },
    },
  } as const;
}

function compile(objects?: readonly string[]) {
  const source = capabilityContract(objects);
  return compileCapabilityPersistenceSchema({
    source_capability_contract_ref: source.ref,
    source_capability_contract_hash: sha256ExactBytes(Buffer.from("exact-capability-source", "utf8")),
    capability_contract: source.value,
    instance_persistence_binding: { dialect: "postgresql", schema_name: "case_instance" },
    compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
    compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
  });
}

test("compiler is deterministic and materializes one table per owned business object", () => {
  const first = compile();
  const second = compile();
  assert.deepEqual(first, second);
  assert.equal(first.content_hash, second.content_hash);
  assert.deepEqual(first.payload.database_object_refs, ["case_instance.case_record", "case_instance.case_evidence"]);
  assert.equal(first.payload.physical_schema_spec.ordered_ddl.length, 2);
  assert.match(first.payload.physical_schema_spec.ordered_ddl[0]!, /"case_instance"\."case_record"/);
  assert.match(first.payload.physical_schema_spec.ordered_ddl[1]!, /"case_instance"\."case_evidence"/);
  for (const ddl of first.payload.physical_schema_spec.ordered_ddl) {
    assert.doesNotMatch(ddl, /capability_id|object_kind/);
  }
});

test("compiler preserves Capability isolation and never coalesces object tables", () => {
  const left = compile(["left_object"]);
  const right = compile(["right_object"]);
  assert.deepEqual(left.payload.database_object_refs, ["case_instance.left_object"]);
  assert.deepEqual(right.payload.database_object_refs, ["case_instance.right_object"]);
  assert.notEqual(left.content_hash, right.content_hash);
});

test("compiler fails closed on invalid SQL-local business object name", () => {
  assert.throws(
    () => compile(["Bad-Object"]),
    (error: unknown) => error instanceof PersistenceSchemaCompileError && error.code === "P1_PERSISTENCE_SQL_NAME_INVALID",
  );
});

test("compiler fails closed on unsupported dialect", () => {
  const source = capabilityContract();
  assert.throws(
    () => compileCapabilityPersistenceSchema({
      source_capability_contract_ref: source.ref,
      source_capability_contract_hash: sha256ExactBytes(Buffer.from("exact-capability-source", "utf8")),
      capability_contract: source.value,
      instance_persistence_binding: { dialect: "sqlite", schema_name: "case_instance" },
      compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
      compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
    }),
    (error: unknown) => error instanceof PersistenceSchemaCompileError && error.code === "P1_PERSISTENCE_DIALECT_UNSUPPORTED",
  );
});

test("compiler fails closed when Operation payload Contract closure is incomplete", () => {
  const source = capabilityContract();
  const broken = structuredClone(source.value) as Record<string, unknown>;
  broken.contracts = {};
  assert.throws(
    () => compileCapabilityPersistenceSchema({
      source_capability_contract_ref: source.ref,
      source_capability_contract_hash: sha256ExactBytes(Buffer.from("exact-capability-source", "utf8")),
      capability_contract: broken,
      instance_persistence_binding: { dialect: "postgresql", schema_name: "case_instance" },
      compiler_profile_ref: PERSISTENCE_COMPILER_PROFILE_REF,
      compiler_profile_hash: PERSISTENCE_COMPILER_PROFILE_HASH,
    }),
    (error: unknown) => error instanceof PersistenceSchemaCompileError && error.code === "P1_PERSISTENCE_OPERATION_CLOSURE_INVALID",
  );
});
