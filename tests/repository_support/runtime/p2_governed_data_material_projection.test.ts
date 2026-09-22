import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  projectP1GovernedDataToP2Material,
} from "../../../runtime/p2_governed_data_material_projection.ts";
import type {
  JsonObject,
  P2GoogleDriveMaterialStore,
} from "../../../runtime/p2_google_drive_material_store.ts";
import {
  handler as createMaterialSet,
  STAGE_CONTRACT_REF,
} from "../../../src/p2/provider/capability_publishing/create_material_set/handler.ts";

function hash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function memoryStore() {
  const writes: Array<Readonly<{
    owner_ref: string;
    subject_ref: string;
    data_category: "STATIC" | "DYNAMIC" | "RUNTIME";
    material: JsonObject;
  }>> = [];

  const store: P2GoogleDriveMaterialStore = Object.freeze({
    async writeJsonObject(input) {
      writes.push(Object.freeze({
        owner_ref: input.owner_ref,
        subject_ref: input.subject_ref,
        data_category: input.data_category,
        material: input.material,
      }));
      const exact = Buffer.from(`${JSON.stringify(input.material)}\n`, "utf8");
      return Object.freeze({
        locator: Object.freeze({
          provider: "GOOGLE_DRIVE" as const,
          root_folder_id: "root",
          owner_folder_id: `owner:${input.owner_ref}`,
          subject_folder_id: `subject:${input.subject_ref}`,
          file_id: `file:${input.data_category}`,
          revision_id: "revision-1",
          file_name: input.data_category === "STATIC"
            ? "static.json"
            : input.data_category === "DYNAMIC"
            ? "dynamic.json"
            : "runtime.json",
          owner_ref: input.owner_ref,
          subject_ref: input.subject_ref,
          data_category: input.data_category,
          content_hash: hash(exact),
        }),
        exact_json_bytes: exact,
      });
    },
    async writeExactJson() {
      throw new Error("projection uses writeJsonObject only");
    },
    async readExact() {
      throw new Error("projection does not read material");
    },
  });

  return { store, writes };
}

const CAPABILITY_CONTRACT_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const PROVIDER_INTERFACE_REF = `${CAPABILITY_CONTRACT_REF}#/interfaces/example_invoke`;

function projectionInput(data_category: "STATIC" | "DYNAMIC" | "RUNTIME") {
  return Object.freeze({
    data_category,
    material_ref: `urn:q:material:${data_category.toLowerCase()}`,
    owner_ref: "Q.TEST.CONTRACT.DOMAIN.EXAMPLE@V0100",
    subject_ref: CAPABILITY_CONTRACT_REF,
    source_ref: `${CAPABILITY_CONTRACT_REF}#/extraction`,
    source_provenance: Object.freeze({
      source_ref: CAPABILITY_CONTRACT_REF,
      revision_ref: `revision:${data_category.toLowerCase()}:1`,
    }),
    source_fact_authority: CAPABILITY_CONTRACT_REF,
    selection_spec: Object.freeze({
      scope: "authorized",
      category: data_category,
    }),
    integrity_profile_ref: "Q.TEST.INTEGRITY.PROFILE@V0100",
    exact_json_material: Object.freeze({
      category_marker: data_category,
      runtime_named_field: "must-not-select-category",
    }),
    trace_id: `trace:${data_category.toLowerCase()}`,
    request_id: `request:${data_category.toLowerCase()}`,
  });
}

test("explicit P1 governed-data categories project to exact P2 static/dynamic/runtime material and preserve lineage", async () => {
  const memory = memoryStore();
  const projected = [];

  for (const category of ["STATIC", "DYNAMIC", "RUNTIME"] as const) {
    const input = projectionInput(category);
    const result = await projectP1GovernedDataToP2Material(input, memory.store);
    projected.push(result.material_set_member);

    assert.equal(result.material_set_member.data_category, category);
    assert.deepEqual(result.material_set_member.source_provenance, input.source_provenance);
    assert.equal(result.material_set_member.source_fact_authority, input.source_fact_authority);
    assert.deepEqual(result.material_set_member.selection_spec, input.selection_spec);
    assert.equal(
      result.material_set_member.material_envelope.content_hash,
      result.stored_material.locator.content_hash,
    );
    assert.equal(result.stored_material.locator.data_category, category);
    assert.equal(
      result.stored_material.locator.file_name,
      category === "STATIC" ? "static.json" : category === "DYNAMIC" ? "dynamic.json" : "runtime.json",
    );
  }

  assert.deepEqual(memory.writes.map((item) => item.data_category), [
    "STATIC",
    "DYNAMIC",
    "RUNTIME",
  ]);

  const materialSetResponse = await createMaterialSet({
    input: {
      capability_contract_ref: CAPABILITY_CONTRACT_REF,
      capability_contract_hash: `sha256:${"a".repeat(64)}`,
      provider_interface_refs: [PROVIDER_INTERFACE_REF],
      materials: projected,
      dependency_closure: [],
      provider_lineage: ["Q.TEST.CONTRACT.DOMAIN.EXAMPLE@V0100"],
    },
    runtime_context: { stage_contract_ref: STAGE_CONTRACT_REF },
    trace_id: "trace:material-set",
    request_id: "request:material-set",
  });

  const materialSet = materialSetResponse.runtime_result.material_set as JsonObject;
  assert.equal(materialSet.publication_eligible, true);
  assert.deepEqual(materialSet.materials, projected);
});

test("projection fails closed when category is undeclared and does not infer from material fields", async () => {
  const memory = memoryStore();
  const input = {
    ...projectionInput("STATIC"),
    data_category: "UNDECLARED",
    exact_json_material: Object.freeze({
      runtime: true,
      runtime_context: { tempting: "but-not-authority" },
      dynamic_payload: true,
    }),
  } as unknown as Parameters<typeof projectP1GovernedDataToP2Material>[0];

  await assert.rejects(
    () => projectP1GovernedDataToP2Material(input, memory.store),
    /data_category must be explicitly STATIC, DYNAMIC, or RUNTIME/,
  );
  assert.equal(memory.writes.length, 0);
});

test("explicit category wins over field names; projector never guesses STATIC/DYNAMIC/RUNTIME", async () => {
  const memory = memoryStore();
  const input = {
    ...projectionInput("STATIC"),
    exact_json_material: Object.freeze({
      runtime: true,
      runtime_context: { value: 1 },
      dynamic_value: 2,
    }),
  };

  const result = await projectP1GovernedDataToP2Material(input, memory.store);
  assert.equal(result.material_set_member.data_category, "STATIC");
  assert.equal(result.stored_material.locator.file_name, "static.json");
  assert.equal(memory.writes[0]?.data_category, "STATIC");
});
