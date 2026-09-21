import assert from "node:assert/strict";
import test from "node:test";
import {
  createP2RuntimeMaterialBackedP1Resolver,
  type P2RuntimeMaterialBinding,
} from "../../../runtime/p2_runtime_material_binding.ts";
import type {
  P1OwnerLocalRuntimeBindingIdentity,
} from "../../../runtime/p1_owner_local_runtime_binding.ts";
import type {
  P2GoogleDriveMaterialLocator,
  P2GoogleDriveMaterialStore,
} from "../../../runtime/p2_google_drive_material_store.ts";

const identity: P1OwnerLocalRuntimeBindingIdentity = Object.freeze({
  capability_contract_ref: "Q.SS.STD.P1.CONTRACT.GATE_CAPABILITY@V0165",
  operation_ref: "Q.SS.STD.P1.CONTRACT.GATE_CAPABILITY@V0165#/operation_catalog/execute_gate",
  interface_ref: "Q.SS.STD.P1.CONTRACT.GATE_CAPABILITY@V0165#/interfaces/gate_execution_invoke",
  binding_set_ref: "Q.CAPABILITY_INSTANCE.GATE.DEFAULT@V0100#binding_set",
  port_refs: Object.freeze([]),
});

const locator: P2GoogleDriveMaterialLocator = Object.freeze({
  provider: "GOOGLE_DRIVE",
  root_folder_id: "root",
  owner_folder_id: "owner-folder",
  subject_folder_id: "subject-folder",
  file_id: "runtime-file",
  revision_id: "runtime-revision",
  file_name: "runtime.json",
  owner_ref: "q.p1.domain.q_gate",
  subject_ref: "Q.SS.STD.P1.CONTRACT.GATE_CAPABILITY@V0165",
  data_category: "RUNTIME",
  content_hash: \`sha256:\${"a".repeat(64)}\`,
});

const binding: P2RuntimeMaterialBinding = Object.freeze({
  material_ref: "urn:q:p2:runtime:gate",
  content_hash: locator.content_hash,
  locator,
});

test("P2 runtime material backs the existing owner-local P1 resolver and materializes executable attributes", async () => {
  let readCalls = 0;
  let factoryCalls = 0;

  const materialStore = Object.freeze({
    async readExact(input) {
      readCalls += 1;
      assert.deepEqual(input.locator, locator);
      return Buffer.from(JSON.stringify({
        authority_source_binding_ref: "authority-ref",
        evaluator_binding_ref: "evaluator-ref",
      }), "utf8");
    },
  }) as unknown as P2GoogleDriveMaterialStore;

  const resolver = createP2RuntimeMaterialBackedP1Resolver({
    binding_resolver: Object.freeze({
      resolveExact(exactIdentity) {
        assert.deepEqual(exactIdentity, identity);
        return binding;
      },
    }),
    material_store: materialStore,
    attribute_factory: Object.freeze({
      materializeExact(input) {
        factoryCalls += 1;
        assert.deepEqual(input.identity, identity);
        assert.deepEqual(input.binding, binding);
        assert.deepEqual(input.runtime_material, {
          authority_source_binding_ref: "authority-ref",
          evaluator_binding_ref: "evaluator-ref",
        });
        return {
          q_gate_runtime_binding: {
            authority_source_reader: async () => "ready",
          },
        };
      },
    }),
    trace_id: "trace-gate",
    request_id: "request-gate",
  });

  const resolved = await resolver.resolveExact(identity);
  assert.equal(readCalls, 1);
  assert.equal(factoryCalls, 1);
  assert.equal(
    typeof (resolved?.attributes.q_gate_runtime_binding as {
      authority_source_reader?: unknown;
    })?.authority_source_reader,
    "function",
  );
});

test("P2 runtime material resolver returns undefined when no exact governed runtime material binding exists", async () => {
  const resolver = createP2RuntimeMaterialBackedP1Resolver({
    binding_resolver: Object.freeze({
      resolveExact: () => undefined,
    }),
    material_store: Object.freeze({
      async readExact() {
        throw new Error("must not read");
      },
    }) as unknown as P2GoogleDriveMaterialStore,
    attribute_factory: Object.freeze({
      materializeExact() {
        throw new Error("must not materialize");
      },
    }),
    trace_id: "trace",
    request_id: "request",
  });

  assert.equal(await resolver.resolveExact(identity), undefined);
});

test("P2 runtime material resolver rejects a non-RUNTIME locator", async () => {
  const badBinding: P2RuntimeMaterialBinding = Object.freeze({
    ...binding,
    locator: Object.freeze({
      ...locator,
      data_category: "STATIC" as const,
      file_name: "static.json",
    }),
  });
  const resolver = createP2RuntimeMaterialBackedP1Resolver({
    binding_resolver: Object.freeze({
      resolveExact: () => badBinding,
    }),
    material_store: Object.freeze({
      async readExact() {
        throw new Error("must not read");
      },
    }) as unknown as P2GoogleDriveMaterialStore,
    attribute_factory: Object.freeze({
      materializeExact() {
        throw new Error("must not materialize");
      },
    }),
    trace_id: "trace",
    request_id: "request",
  });

  await assert.rejects(
    () => resolver.resolveExact(identity),
    /runtime material binding must resolve a RUNTIME locator/,
  );
});
