import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  P1OwnerLocalRuntimeBindingIdentity,
} from "../../../runtime/p1_owner_local_runtime_binding.ts";
import {
  createP1DynamicVariableRuntimeResolver,
  type P1DynamicVariableRuntimeBinding,
} from "../../../runtime/p1_dynamic_variable_runtime_resolver.ts";
import type {
  P2GoogleDriveMaterialLocator,
  P2GoogleDriveMaterialStore,
} from "../../../runtime/p2_google_drive_material_store.ts";

const CAPABILITY_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";

const IDENTITY: P1OwnerLocalRuntimeBindingIdentity = Object.freeze({
  capability_contract_ref: CAPABILITY_REF,
  operation_ref: `${CAPABILITY_REF}#/operations/run`,
  interface_ref: `${CAPABILITY_REF}#/interfaces/run_invoke`,
  binding_set_ref: "Q.TEST.BINDING.SET@V0100",
  port_refs: Object.freeze([]),
});

const LOCATOR: P2GoogleDriveMaterialLocator = Object.freeze({
  provider: "GOOGLE_DRIVE",
  root_folder_id: "root-1",
  owner_folder_id: "owner-1",
  subject_folder_id: "subject-1",
  file_id: "file-1",
  revision_id: "revision-1",
  file_name: "runtime.json",
  owner_ref: "owner:test",
  subject_ref: CAPABILITY_REF,
  data_category: "RUNTIME",
  content_hash:
    "sha256:1111111111111111111111111111111111111111111111111111111111111111",
});

function binding(
  source_kind:
    | "CONTRACT_GENERAL_FACT"
    | "INSTANCE_PARAMETER"
    | "INSTANCE_BINDING" = "CONTRACT_GENERAL_FACT",
): P1DynamicVariableRuntimeBinding {
  return Object.freeze({
    binding_ref: "binding:runtime-material",
    variable_ref: "variable:runtime-material",
    source_kind,
    source_lineage: Object.freeze({
      exact_source_ref: "Q.TEST.SOURCE@V0100#/runtime_binding",
      exact_source_hash:
        "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    }),
    material_ref: "material:runtime",
    locator: LOCATOR,
  });
}

function materialStore(
  bytes = Buffer.from('{"resource_ref":"runtime:resource:exact"}\n', "utf8"),
): P2GoogleDriveMaterialStore {
  return Object.freeze({
    async readExact(input) {
      assert.deepEqual(input.locator, LOCATOR);
      assert.equal(input.trace_id, "trace-1");
      assert.equal(input.request_id, "request-1");
      return Uint8Array.from(bytes);
    },
    async writeExactJson() {
      throw new Error("write is not part of runtime resolution");
    },
    async writeJsonObject() {
      throw new Error("write is not part of runtime resolution");
    },
  });
}

test("generic dynamic-variable resolver exact-reads P2 RUNTIME material and returns only resolved P0 attributes", async () => {
  let seenIdentity: Readonly<P1OwnerLocalRuntimeBindingIdentity> | undefined;
  let seenBinding: Readonly<P1DynamicVariableRuntimeBinding> | undefined;
  let seenMaterial: Readonly<Record<string, unknown>> | undefined;

  const resolver = createP1DynamicVariableRuntimeResolver({
    binding_port: Object.freeze({
      resolveExact(identity) {
        seenIdentity = identity;
        return binding();
      },
    }),
    material_store: materialStore(),
    reference_resolver: Object.freeze({
      resolveExact(input) {
        seenBinding = input.binding;
        seenMaterial = input.runtime_material;
        return {
          exact_resource: Object.freeze({
            ref: input.runtime_material.resource_ref,
          }),
        };
      },
    }),
    trace_id: "trace-1",
    request_id: "request-1",
  });

  const resolved = await resolver.resolveExact(IDENTITY);

  assert.deepEqual(seenIdentity, IDENTITY);
  assert.equal(seenBinding?.source_kind, "CONTRACT_GENERAL_FACT");
  assert.deepEqual(seenMaterial, {
    resource_ref: "runtime:resource:exact",
  });
  assert.deepEqual(resolved?.attributes, {
    exact_resource: {
      ref: "runtime:resource:exact",
    },
  });
  assert.ok(Object.isFrozen(resolved));
  assert.ok(Object.isFrozen(resolved?.attributes));
});

test("generic resolver accepts only the three governed dynamic-variable source kinds", async () => {
  for (const sourceKind of [
    "CONTRACT_GENERAL_FACT",
    "INSTANCE_PARAMETER",
    "INSTANCE_BINDING",
  ] as const) {
    const resolver = createP1DynamicVariableRuntimeResolver({
      binding_port: Object.freeze({
        resolveExact: () => binding(sourceKind),
      }),
      material_store: materialStore(),
      reference_resolver: Object.freeze({
        resolveExact: () => ({ ready: true }),
      }),
      trace_id: "trace-1",
      request_id: "request-1",
    });
    assert.deepEqual(await resolver.resolveExact(IDENTITY), {
      attributes: { ready: true },
    });
  }
});

test("generic resolver fails closed when no exact binding exists and does not read storage", async () => {
  let reads = 0;
  const resolver = createP1DynamicVariableRuntimeResolver({
    binding_port: Object.freeze({
      resolveExact: () => undefined,
    }),
    material_store: Object.freeze({
      async readExact() {
        reads += 1;
        throw new Error("must not be reached");
      },
      async writeExactJson() {
        throw new Error("must not be reached");
      },
      async writeJsonObject() {
        throw new Error("must not be reached");
      },
    }),
    reference_resolver: Object.freeze({
      resolveExact: () => {
        throw new Error("must not be reached");
      },
    }),
    trace_id: "trace-1",
    request_id: "request-1",
  });

  assert.equal(await resolver.resolveExact(IDENTITY), undefined);
  assert.equal(reads, 0);
});

test("generic resolver rejects non-RUNTIME locators before material read", async () => {
  const wrongLocator = Object.freeze({
    ...LOCATOR,
    data_category: "DYNAMIC" as const,
    file_name: "dynamic.json",
  });
  const resolver = createP1DynamicVariableRuntimeResolver({
    binding_port: Object.freeze({
      resolveExact: () => Object.freeze({
        ...binding(),
        locator: wrongLocator,
      }),
    }),
    material_store: materialStore(),
    reference_resolver: Object.freeze({
      resolveExact: () => ({ ready: true }),
    }),
    trace_id: "trace-1",
    request_id: "request-1",
  });

  await assert.rejects(
    () => resolver.resolveExact(IDENTITY),
    /requires RUNTIME material/,
  );
});

test("generic resolver rejects malformed runtime JSON before reference resolution", async () => {
  let resolutions = 0;
  const resolver = createP1DynamicVariableRuntimeResolver({
    binding_port: Object.freeze({
      resolveExact: () => binding(),
    }),
    material_store: materialStore(Buffer.from("{", "utf8")),
    reference_resolver: Object.freeze({
      resolveExact: () => {
        resolutions += 1;
        return {};
      },
    }),
    trace_id: "trace-1",
    request_id: "request-1",
  });

  await assert.rejects(
    () => resolver.resolveExact(IDENTITY),
    /runtime material must be valid JSON/,
  );
  assert.equal(resolutions, 0);
});

test("generic resolver propagates ambiguous governed binding failure and performs no fallback", async () => {
  const resolver = createP1DynamicVariableRuntimeResolver({
    binding_port: Object.freeze({
      resolveExact() {
        throw new Error("AMBIGUOUS_DYNAMIC_VARIABLE_BINDING");
      },
    }),
    material_store: materialStore(),
    reference_resolver: Object.freeze({
      resolveExact: () => ({ ready: true }),
    }),
    trace_id: "trace-1",
    request_id: "request-1",
  });

  await assert.rejects(
    () => resolver.resolveExact(IDENTITY),
    /AMBIGUOUS_DYNAMIC_VARIABLE_BINDING/,
  );
});

test("resolver source remains Domain-neutral and contains no Domain-specific runtime branch", async () => {
  const source = await readFile(
    new URL(
      "../../../runtime/p1_dynamic_variable_runtime_resolver.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /Q\.Gate|Q\.Cloud|Q\.UI|q_gate_runtime_binding/);
  assert.doesNotMatch(source, /latest|legacy|historical/i);
});
